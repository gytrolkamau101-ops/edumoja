-- EduMoja ↔ ExaMoja Pro access (FIXED — no public.profiles)
-- Staff live in public.users (see 001_schema.sql)

create table if not exists public.examoja_access (
  school_id uuid primary key references public.schools(id) on delete cascade,
  examoja_school_id text,
  plan text default 'pro',
  plan_expires timestamptz,
  seats_teachers int default 5,
  seats_students int default 100,
  school_email text,
  school_username text,
  school_password_plain text,
  join_code text,
  credentials jsonb default '[]'::jsonb,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_examoja_access_expires
  on public.examoja_access (plan_expires);

alter table public.examoja_access enable row level security;

drop policy if exists examoja_access_school on public.examoja_access;

-- Prefer my_school_id() when present; else fall back to public.users
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'my_school_id'
  ) then
    execute $p$
      create policy examoja_access_school on public.examoja_access
        for all
        using (school_id = public.my_school_id())
        with check (school_id = public.my_school_id())
    $p$;
  else
    execute $p$
      create policy examoja_access_school on public.examoja_access
        for all
        using (
          school_id in (
            select u.school_id from public.users u where u.id = auth.uid()
          )
        )
        with check (
          school_id in (
            select u.school_id from public.users u where u.id = auth.uid()
          )
        )
    $p$;
  end if;
end $$;

comment on table public.examoja_access is
  'Pro-tier ExaMoja seats; passwords shown only while Pro active';
