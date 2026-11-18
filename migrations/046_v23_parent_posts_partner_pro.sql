-- EduMoja v23: parent portal publish queue + no partner reward on Pro

create table if not exists public.parent_portal_posts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  post_type text not null check (post_type in ('results','fees','attendance','notice')),
  title text not null default '',
  body jsonb not null default '{}'::jsonb,
  published_at timestamptz not null default now(),
  published_by uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists parent_portal_posts_school_idx
  on public.parent_portal_posts (school_id, is_active, published_at desc);
create index if not exists parent_portal_posts_student_idx
  on public.parent_portal_posts (student_id) where student_id is not null;

alter table public.parent_portal_posts enable row level security;

drop policy if exists parent_portal_posts_staff on public.parent_portal_posts;
create policy parent_portal_posts_staff on public.parent_portal_posts
  for all using (
    school_id in (select school_id from public.users where id = auth.uid() and status = 'active')
    or exists (select 1 from public.platform_admins where id = auth.uid())
    or (
      -- parents: active posts for their linked children or school-wide (student_id null)
      exists (
        select 1 from public.parents p
        where p.id = auth.uid() and p.status = 'active'
      )
      and is_active = true
      and (
        student_id is null
        or student_id in (
          select student_id from public.parent_children
          where parent_id = auth.uid() and status = 'approved'
        )
      )
    )
  )
  with check (
    school_id in (select school_id from public.users where id = auth.uid() and status = 'active')
    or exists (select 1 from public.platform_admins where id = auth.uid())
  );

-- Referral / partner: Basic + Premium only — Pro must pay, no activation_bonus
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
    -- Pro / full / custom: no referral reward
    if pl in ('pro', 'full', 'custom') then
      return NEW;
    end if;
    select * into cfg from public.partner_payout_config where id = 1;
    amt := case pl
      when 'premium' then coalesce(cfg.bonus_premium, 350)
      when 'standard' then coalesce(cfg.bonus_premium, 350)
      when 'basic' then coalesce(cfg.bonus_basic, 200)
      when 'starter' then coalesce(cfg.bonus_basic, 200)
      when 'trial' then coalesce(cfg.bonus_basic, 200)
      else 0
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
