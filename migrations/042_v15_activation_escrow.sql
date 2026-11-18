-- EduMoja v15: school activation gate + partner virtual escrow ledger
-- New schools stay status=pending until Super Admin activates (plan + days).
-- Partner rewards accrue as ledger credits; cash leaves only after Super Admin payout approval.

-- 1) School lifecycle columns
alter table public.schools
  add column if not exists status text default 'pending',
  add column if not exists is_suspended boolean default false,
  add column if not exists activated_at timestamptz,
  add column if not exists activation_days int,
  add column if not exists activated_by uuid,
  add column if not exists plan_paused_at timestamptz,
  add column if not exists plan_paused_remaining_days int;

-- Tighten status values when possible
do $$
begin
  update public.schools set status = 'active' where status is null and coalesce(is_suspended, false) = false;
  update public.schools set status = 'suspended' where coalesce(is_suspended, false) = true;
exception when others then null;
end $$;

-- 2) Partner virtual escrow (balance = sum credits - sum debits)
create table if not exists public.partner_ledger (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  entry_type text not null check (entry_type in ('credit','debit','hold','release','adjust')),
  amount_kes numeric not null check (amount_kes >= 0),
  reason text,
  school_id uuid references public.schools(id) on delete set null,
  payout_event_id uuid,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid
);

create index if not exists partner_ledger_partner_idx on public.partner_ledger (partner_id, created_at desc);

alter table public.partner_ledger enable row level security;

-- Platform admins manage; partners read own via security definer helper if needed later
drop policy if exists partner_ledger_admin on public.partner_ledger;
create policy partner_ledger_admin on public.partner_ledger
  for all using (
    exists (select 1 from public.platform_admins where id = auth.uid())
  ) with check (
    exists (select 1 from public.platform_admins where id = auth.uid())
  );

-- 3) Signup: new school is PENDING until Super Admin activates
create or replace function public.handle_new_staff_inline(uid uuid, uemail text, meta jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  sid uuid; code text; r text; lvl text; ref text; v jsonb; ref_school uuid;
  partner_ref text; partner_uuid uuid;
begin
  if coalesce(meta->>'school_name','') <> '' then
    ref := upper(trim(coalesce(meta->>'referral_code','')));
    if ref = '' then
      raise exception 'Referral code is required';
    end if;
    v := public.validate_referral_code(ref);
    if coalesce((v->>'ok')::boolean, false) is not true then
      raise exception '%', coalesce(v->>'error', 'Invalid referral code');
    end if;
    if v->>'source' = 'school' then
      ref_school := (v->>'school_id')::uuid;
    else
      ref_school := null;
    end if;

    partner_ref := upper(trim(coalesce(meta->>'referred_by_partner_code','')));
    partner_uuid := null;
    if partner_ref <> '' then
      select id into partner_uuid from public.partners where upper(code) = partner_ref and status = 'active' limit 1;
    end if;

    loop
      code := upper(substr(md5(random()::text), 1, 6));
      exit when not exists (select 1 from public.schools where school_code = code);
    end loop;
    lvl := meta->>'school_level';
    if lvl not in ('primary','secondary','combined') then lvl := 'primary'; end if;

    -- Pending: no paid access until Super Admin activates
    insert into public.schools (
      school_name, school_code, school_level, referred_by_code, referred_by_school_id,
      plan, trial_ends_at, plan_expires_at, student_cap, status, is_suspended
    ) values (
      trim(meta->>'school_name'), code, lvl, ref, ref_school,
      'free', null, null, 80, 'pending', false
    ) returning id into sid;

    begin
      insert into public.referral_signups (referral_code, school_id) values (ref, sid);
    exception when others then null;
    end;

    if partner_uuid is not null then
      begin
        update public.schools set partner_id = partner_uuid where id = sid;
      exception when others then null;
      end;
    end if;

    -- Principal can log in; AccountGate shows "awaiting activation"
    insert into public.users (id, school_id, email, full_name, role, status)
      values (uid, sid, uemail, coalesce(nullif(meta->>'full_name',''), 'Principal'), 'Principal', 'active');
  else
    select id into sid from public.schools where school_code = upper(trim(coalesce(meta->>'school_code','')));
    if sid is null then
      raise exception 'Invalid school details';
    end if;
    r := meta->>'role';
    if r not in ('Teacher','Secretary','Deputy Principal','Senior Teacher') then r := 'Teacher'; end if;
    if r = 'Principal' then r := 'Teacher'; end if;
    insert into public.users (id, school_id, email, full_name, role, status)
      values (uid, sid, uemail, coalesce(nullif(meta->>'full_name',''), 'Staff'), r, 'pending');
  end if;
end $$;

-- 4) Super Admin: activate school with plan + duration (timer starts now)
create or replace function public.admin_activate_school(
  p_school_id uuid,
  p_plan text,
  p_days int
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  pl text;
  days int;
  exp timestamptz;
begin
  if not exists (select 1 from public.platform_admins where id = auth.uid()) then
    raise exception 'Not a platform admin';
  end if;
  pl := lower(trim(coalesce(p_plan, 'basic')));
  if pl not in ('basic','starter','premium','standard','pro','full','trial','free') then
    pl := 'basic';
  end if;
  -- normalize street names to DB-ish
  if pl = 'starter' then pl := 'basic'; end if;
  if pl = 'standard' then pl := 'premium'; end if;
  if pl = 'full' then pl := 'pro'; end if;

  days := greatest(1, least(coalesce(p_days, 30), 730));
  exp := now() + make_interval(days => days);

  update public.schools set
    status = 'active',
    is_suspended = false,
    plan = pl,
    plan_expires_at = exp,
    trial_ends_at = case when pl = 'trial' then exp else trial_ends_at end,
    activated_at = now(),
    activation_days = days,
    activated_by = auth.uid(),
    plan_paused_at = null,
    plan_paused_remaining_days = null
  where id = p_school_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'School not found');
  end if;

  return jsonb_build_object('ok', true, 'plan', pl, 'days', days, 'expires_at', exp);
end $$;

revoke all on function public.admin_activate_school(uuid, text, int) from public, anon, authenticated;
grant execute on function public.admin_activate_school(uuid, text, int) to authenticated;

-- 5) Pause / resume subscription clock
create or replace function public.admin_pause_school(p_school_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  exp timestamptz;
  rem int;
begin
  if not exists (select 1 from public.platform_admins where id = auth.uid()) then
    raise exception 'Not a platform admin';
  end if;
  select plan_expires_at into exp from public.schools where id = p_school_id;
  if exp is null then
    rem := 0;
  else
    rem := greatest(0, ceil(extract(epoch from (exp - now())) / 86400.0)::int);
  end if;
  update public.schools set
    status = 'suspended',
    is_suspended = true,
    plan_paused_at = now(),
    plan_paused_remaining_days = rem
  where id = p_school_id;
  return jsonb_build_object('ok', true, 'remaining_days', rem);
end $$;

create or replace function public.admin_resume_school(p_school_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  rem int;
  exp timestamptz;
begin
  if not exists (select 1 from public.platform_admins where id = auth.uid()) then
    raise exception 'Not a platform admin';
  end if;
  select coalesce(plan_paused_remaining_days, 0) into rem from public.schools where id = p_school_id;
  exp := now() + make_interval(days => greatest(rem, 1));
  update public.schools set
    status = 'active',
    is_suspended = false,
    plan_expires_at = exp,
    plan_paused_at = null,
    plan_paused_remaining_days = null
  where id = p_school_id;
  return jsonb_build_object('ok', true, 'expires_at', exp, 'days', greatest(rem, 1));
end $$;

revoke all on function public.admin_pause_school(uuid) from public, anon, authenticated;
revoke all on function public.admin_resume_school(uuid) from public, anon, authenticated;
grant execute on function public.admin_pause_school(uuid) to authenticated;
grant execute on function public.admin_resume_school(uuid) to authenticated;

-- Credit partner escrow when school is first activated (signup reward — one-time)
create or replace function public.credit_partner_on_activation()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  pid uuid;
  amt numeric;
  cfg record;
begin
  if TG_OP = 'UPDATE'
     and OLD.status is distinct from 'active'
     and NEW.status = 'active'
     and NEW.partner_id is not null then
    pid := NEW.partner_id;
    select * into cfg from public.partner_payout_config where id = 1;
    amt := case lower(NEW.plan)
      when 'pro' then coalesce(cfg.bonus_pro, 500)
      when 'premium' then coalesce(cfg.bonus_premium, 350)
      when 'basic' then coalesce(cfg.bonus_basic, 200)
      when 'trial' then coalesce(cfg.bonus_basic, 200)
      else coalesce(cfg.bonus_basic, 200)
    end;
    if amt > 0 and not exists (
      select 1 from public.partner_ledger
      where partner_id = pid and school_id = NEW.id and reason = 'activation_bonus'
    ) then
      insert into public.partner_ledger (partner_id, entry_type, amount_kes, reason, school_id, created_by)
      values (pid, 'credit', amt, 'activation_bonus', NEW.id, NEW.activated_by);
    end if;
  end if;
  return NEW;
end $$;

drop trigger if exists trg_partner_credit_on_activation on public.schools;
create trigger trg_partner_credit_on_activation
  after update of status on public.schools
  for each row execute function public.credit_partner_on_activation();
