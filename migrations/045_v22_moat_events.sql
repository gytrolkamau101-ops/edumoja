-- EduMoja v22: moat event log (operational facts, school-scoped)
create table if not exists public.school_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  event_type text not null,
  entity text,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid
);

create index if not exists school_events_school_created_idx
  on public.school_events (school_id, created_at desc);
create index if not exists school_events_type_idx
  on public.school_events (event_type);

alter table public.school_events enable row level security;

drop policy if exists school_events_staff on public.school_events;
create policy school_events_staff on public.school_events
  for all using (
    school_id in (select school_id from public.users where id = auth.uid() and status = 'active')
    or exists (select 1 from public.platform_admins where id = auth.uid())
  ) with check (
    school_id in (select school_id from public.users where id = auth.uid() and status = 'active')
    or exists (select 1 from public.platform_admins where id = auth.uid())
  );

comment on table public.school_events is 'Moat: timestamped school-scoped operational events for analytics; not a payment rail';
