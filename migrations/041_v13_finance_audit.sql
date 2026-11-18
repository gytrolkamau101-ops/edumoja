-- EduMoja v13: audit-oriented finance columns (Kenya school finance structure)
-- Codes/streams are product truth; shilling rates stay configurable / free-text.

-- Capitation: structured vote head + optional term link already exists
alter table public.capitation_entries
  add column if not exists vote_head text,
  add column if not exists bom_approved_on date,
  add column if not exists bom_minute_ref text,
  add column if not exists reference text;

-- School fund lines: BOM trail + learner link for NG-CDF / fee-linked notes
alter table public.school_fund_entries
  add column if not exists bom_approved_on date,
  add column if not exists bom_minute_ref text,
  add column if not exists learner_id uuid,
  add column if not exists stream text;

-- Generic expenses table (if present)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'expenses') then
    alter table public.expenses
      add column if not exists bom_approved_on date,
      add column if not exists bom_minute_ref text,
      add column if not exists vote_head text,
      add column if not exists stream text;
  end if;
end $$;

comment on column public.capitation_entries.vote_head is 'MoE-style: tuition|maintenance|medical|activity|smasse|textbooks|other or label';
comment on column public.school_fund_entries.stream is 'capitation|student_fees|boarding_fees|pta_levy|ng_cdf|donor|other|in_kind';
