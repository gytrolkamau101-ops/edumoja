-- Internal staff messaging (teacher ↔ principal/secretary/teachers)
create table if not exists public.staff_messages (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  from_user_id uuid not null references public.users(id) on delete cascade,
  to_user_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_staff_messages_to on public.staff_messages (to_user_id, read_at);
create index if not exists idx_staff_messages_school on public.staff_messages (school_id, created_at desc);

alter table public.staff_messages enable row level security;

drop policy if exists staff_messages_rw on public.staff_messages;
create policy staff_messages_rw on public.staff_messages
  for all using (
    school_id = public.my_school_id()
    and (from_user_id = auth.uid() or to_user_id = auth.uid())
  )
  with check (
    school_id = public.my_school_id()
    and from_user_id = auth.uid()
  );

comment on table public.staff_messages is 'In-app messages between staff at the same school';
