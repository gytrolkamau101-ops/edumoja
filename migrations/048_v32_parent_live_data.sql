-- Parent live fee openings + ensure exam/subject reads
drop policy if exists "parent reads own openings" on public.fee_opening_balances;
create policy "parent reads own openings" on public.fee_opening_balances
  for select using (
    student_id in (
      select student_id from public.parent_children
      where parent_id = auth.uid() and status = 'approved'
    )
  );

-- Helpful if subject_allocations blocked
drop policy if exists "parent reads subject allocations" on public.subject_allocations;
create policy "parent reads subject allocations" on public.subject_allocations
  for select using (
    school_id in (
      select school_id from public.parent_children
      where parent_id = auth.uid() and status = 'approved'
    )
    or school_id in (select school_id from public.users where id = auth.uid() and status = 'active')
  );
