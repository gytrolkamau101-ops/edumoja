-- Pro: school-owned IntaSend for learner fee STK (money never hits EduMoja platform)
-- Run once in Supabase SQL editor.

alter table public.schools
  add column if not exists fee_stk_enabled boolean not null default false,
  add column if not exists intasend_publishable_key text,
  add column if not exists intasend_secret_key text;

comment on column public.schools.fee_stk_enabled is 'Pro only: allow STK fee prompts using school merchant keys';
comment on column public.schools.intasend_secret_key is 'School IntaSend secret — service role / STK function only; never expose to parents';

-- Parents / staff must not SELECT secret via anon. Prefer column privilege revoke if roles exist.
do $$
begin
  revoke select (intasend_secret_key) on public.schools from anon, authenticated;
exception when others then
  null;
end $$;
