-- EduMoja v34: alumni grouped by graduation year on Student fees.
--
-- students.status already supports 'Alumni' (023_v41_status_fix.sql), but
-- nothing records WHEN a learner became an alumnus, so the fees screen had
-- no way to group "all 2026 alumni" together as asked. Adds the year and
-- backfills it as best-effort for any learner already marked Alumni before
-- this migration (from the current term's year, which is the closest
-- available signal — not exact for older alumni records, but a reasonable
-- one-time default; new promotions from here on stamp the real year).

alter table public.students
  add column if not exists alumni_year int;

update public.students s
set alumni_year = t.year
from public.terms t
where s.status = 'Alumni'
  and s.alumni_year is null
  and t.school_id = s.school_id
  and t.is_current = true;
