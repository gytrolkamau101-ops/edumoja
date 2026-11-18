-- EduMoja v24: partner escrow amounts + activation requests (anti-farm, transparent portal)

-- Bonus schedule: Basic 500 / Premium 1000 / Pro 2000 (one-time activation commission)
insert into public.partner_payout_config (id, bonus_basic, bonus_premium, bonus_pro, commission_pct)
values (1, 500, 1000, 2000, 0)
on conflict (id) do update set
  bonus_basic = excluded.bonus_basic,
  bonus_premium = excluded.bonus_premium,
  bonus_pro = excluded.bonus_pro,
  commission_pct = 0;

-- Partner asks admin to activate a referred school (triggers WhatsApp/ops workflow)
create table if not exists public.partner_activation_requests (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  status text not null default 'pending_admin'
    check (status in ('pending_admin','approved','rejected','cancelled')),
  school_plan text,
  subscription_amount_kes numeric,
  commission_kes numeric not null default 0,
  note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid,
  unique (partner_id, school_id)
);

create index if not exists partner_activation_requests_status_idx
  on public.partner_activation_requests (status, created_at desc);

alter table public.partner_activation_requests enable row level security;

drop policy if exists partner_activation_requests_admin on public.partner_activation_requests;
create policy partner_activation_requests_admin on public.partner_activation_requests
  for all using (
    exists (select 1 from public.platform_admins where id = auth.uid())
  ) with check (
    exists (select 1 from public.platform_admins where id = auth.uid())
  );

-- Align ledger credit amounts with 500/1000/2000; Pro allowed but only after real activation
create or replace function public.credit_partner_on_activation()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  pid uuid;
  amt numeric;
  cfg record;
  pl text;
begin
  if TG_OP = 'UPDATE'
     and OLD.status is distinct from 'active'
     and NEW.status = 'active'
     and NEW.partner_id is not null then
    pid := NEW.partner_id;
    pl := lower(trim(coalesce(NEW.plan, 'free')));
    select * into cfg from public.partner_payout_config where id = 1;
    amt := case pl
      when 'pro' then coalesce(cfg.bonus_pro, 2000)
      when 'full' then coalesce(cfg.bonus_pro, 2000)
      when 'premium' then coalesce(cfg.bonus_premium, 1000)
      when 'standard' then coalesce(cfg.bonus_premium, 1000)
      when 'basic' then coalesce(cfg.bonus_basic, 500)
      when 'starter' then coalesce(cfg.bonus_basic, 500)
      when 'trial' then 0
      else 0
    end;
    if amt > 0 and not exists (
      select 1 from public.partner_ledger
      where partner_id = pid and school_id = NEW.id and reason = 'activation_bonus'
    ) then
      insert into public.partner_ledger (partner_id, entry_type, amount_kes, reason, school_id, created_by)
      values (pid, 'credit', amt, 'activation_bonus', NEW.id, NEW.activated_by);
    end if;
    update public.partner_activation_requests
      set status = 'approved', resolved_at = now(), resolved_by = NEW.activated_by
      where school_id = NEW.id and partner_id = pid and status = 'pending_admin';
  end if;
  return NEW;
end $$;

-- Public RPC: partner portal stats + escrow pipeline (code-gated, no PII dump)
create or replace function public.get_partner_stats(p_code text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p record;
  referred int;
  confirmed int;
  pending_total numeric;
  paid_total numeric;
  available_total numeric;
  pipeline jsonb;
begin
  select * into p from public.partners where upper(code) = upper(trim(p_code)) limit 1;
  if p.id is null then
    return jsonb_build_object('ok', false, 'error', 'Partner code not found');
  end if;

  select count(*) into referred from public.schools where partner_id = p.id;
  select count(*) into confirmed from public.schools
    where partner_id = p.id and status = 'active' and lower(coalesce(plan,'free')) not in ('free','trial');

  select coalesce(sum(amount_kes),0) into pending_total from public.partner_ledger
    where partner_id = p.id and entry_type = 'credit' and reason = 'activation_bonus'
    and not exists (
      select 1 from public.partner_ledger d
      where d.partner_id = p.id and d.school_id = partner_ledger.school_id
        and d.entry_type = 'debit' and d.reason in ('payout','clawback')
    );

  -- simplified: paid = debits marked payout
  select coalesce(sum(amount_kes),0) into paid_total from public.partner_ledger
    where partner_id = p.id and entry_type = 'debit' and reason = 'payout';

  available_total := greatest(pending_total - paid_total, 0);

  select coalesce(jsonb_agg(x.obj order by x.created_at desc), '[]'::jsonb) into pipeline
  from (
    select s.created_at,
      jsonb_build_object(
        'school_name', s.school_name,
        'school_code', s.school_code,
        'plan', s.plan,
        'school_status', s.status,
        'subscription_kes', case lower(coalesce(s.plan,'free'))
          when 'pro' then 10000 when 'full' then 10000
          when 'premium' then 5000 when 'standard' then 5000
          when 'basic' then 3000 when 'starter' then 3000
          else 0 end,
        'commission_kes', case lower(coalesce(s.plan,'free'))
          when 'pro' then 2000 when 'full' then 2000
          when 'premium' then 1000 when 'standard' then 1000
          when 'basic' then 500 when 'starter' then 500
          else 0 end,
        'pipeline_status', case
          when s.status = 'active' then 'commission_released'
          when exists (
            select 1 from public.partner_activation_requests r
            where r.school_id = s.id and r.partner_id = p.id and r.status = 'pending_admin'
          ) then 'pending_admin_activation'
          when s.status = 'pending' then 'awaiting_partner_request'
          when s.status = 'suspended' then 'suspended'
          else coalesce(s.status, 'unknown')
        end
      ) as obj
    from public.schools s
    where s.partner_id = p.id
    order by s.created_at desc
    limit 30
  ) x;

  return jsonb_build_object(
    'ok', true,
    'full_name', p.full_name,
    'referral_code', p.code,
    'status', p.status,
    'phone', p.phone,
    'schools_referred', referred,
    'schools_confirmed', confirmed,
    'pending_payout', available_total,
    'paid_lifetime', paid_total,
    'bonus_schedule', jsonb_build_object('basic', 500, 'premium', 1000, 'pro', 2000),
    'pipeline', coalesce(pipeline, '[]'::jsonb),
    'escrow_note', 'School subscription is paid to EduMoja. Your withdrawable amount is the commission only (500/1000/2000), released after admin activates the school.'
  );
end $$;

grant execute on function public.get_partner_stats(text) to anon, authenticated;

-- Partner requests activation (by code + school_code) — rate-limited by unique pair
create or replace function public.partner_request_activation(p_code text, p_school_code text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p record;
  s record;
  comm numeric;
  sub numeric;
  pl text;
begin
  select * into p from public.partners where upper(code) = upper(trim(p_code)) and status = 'active' limit 1;
  if p.id is null then
    return jsonb_build_object('ok', false, 'error', 'Invalid or suspended partner code');
  end if;
  select * into s from public.schools where upper(school_code) = upper(trim(p_school_code)) and partner_id = p.id limit 1;
  if s.id is null then
    return jsonb_build_object('ok', false, 'error', 'School not found under your partner code');
  end if;
  if s.status = 'active' then
    return jsonb_build_object('ok', false, 'error', 'School already active');
  end if;
  pl := lower(coalesce(s.plan, 'basic'));
  comm := case pl
    when 'pro' then 2000 when 'full' then 2000
    when 'premium' then 1000 when 'standard' then 1000
    when 'basic' then 500 when 'starter' then 500
    else 500 end;
  sub := case pl
    when 'pro' then 10000 when 'full' then 10000
    when 'premium' then 5000 when 'standard' then 5000
    when 'basic' then 3000 when 'starter' then 3000
    else 3000 end;

  insert into public.partner_activation_requests (
    partner_id, school_id, status, school_plan, subscription_amount_kes, commission_kes, note
  ) values (
    p.id, s.id, 'pending_admin', pl, sub, comm,
    'Partner requested activation via portal'
  )
  on conflict (partner_id, school_id) do update set
    status = 'pending_admin',
    school_plan = excluded.school_plan,
    subscription_amount_kes = excluded.subscription_amount_kes,
    commission_kes = excluded.commission_kes,
    note = excluded.note,
    created_at = now(),
    resolved_at = null,
    resolved_by = null;

  return jsonb_build_object(
    'ok', true,
    'message', 'Activation requested. EduMoja admin will verify payment and activate.',
    'school_name', s.school_name,
    'school_code', s.school_code,
    'commission_kes', comm,
    'subscription_kes', sub,
    'whatsapp_hint', 'Admin should be notified to activate ' || coalesce(s.school_name,'school') || ' (' || coalesce(s.school_code,'') || ') plan ' || pl
  );
end $$;

grant execute on function public.partner_request_activation(text, text) to anon, authenticated;
