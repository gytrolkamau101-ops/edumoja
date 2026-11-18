-- EduMoja v21: Suspend-with-reason + a readable partner ledger balance.
--
-- 1) Suspend reason: admin_pause_school had no way to record WHY a school was
--    suspended (non-payment? abuse? requested by the school?). Add the column
--    and a new overloaded function that takes an optional reason, so existing
--    calls to admin_pause_school(uuid) keep working unchanged.
--
-- 2) Partner ledger balance: since v15 (migration 042), credit_partner_on_activation
--    has been silently writing rows into partner_ledger on every school activation
--    — but nothing in the admin UI ever reads that table. partner_payout_events /
--    partner_payout_config (used by PartnersTab.jsx) are a separate, older manual
--    payout-request flow that was never wired to the ledger. This view gives the
--    admin panel one place to read each partner's real ledger balance
--    (sum of credits − sum of debits) without duplicating that logic in JS.

alter table public.schools
  add column if not exists suspend_reason text;

create or replace function public.admin_pause_school(p_school_id uuid, p_reason text default null)
returns jsonb
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
    plan_paused_remaining_days = rem,
    suspend_reason = p_reason
  where id = p_school_id;
  return jsonb_build_object('ok', true, 'remaining_days', rem);
end $$;

-- Resume clears the reason — it no longer applies once access is back.
create or replace function public.admin_resume_school(p_school_id uuid)
returns jsonb
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
    plan_paused_remaining_days = null,
    suspend_reason = null
  where id = p_school_id;
  return jsonb_build_object('ok', true, 'expires_at', exp, 'days', greatest(rem, 1));
end $$;

revoke all on function public.admin_pause_school(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_pause_school(uuid, text) to authenticated;
revoke all on function public.admin_resume_school(uuid) from public, anon, authenticated;
grant execute on function public.admin_resume_school(uuid) to authenticated;

-- Per-partner ledger balance: credits minus debits, plus a breakdown by reason
-- so "activation_bonus" accruals are visible separately from any future
-- renewal/sustain-bonus reason the ledger might carry.
create or replace view public.partner_ledger_balances as
select
  p.id as partner_id,
  p.full_name,
  p.phone,
  coalesce(sum(l.amount_kes) filter (where l.entry_type = 'credit'), 0) as total_credited,
  coalesce(sum(l.amount_kes) filter (where l.entry_type = 'debit'), 0) as total_debited,
  coalesce(sum(l.amount_kes) filter (where l.entry_type = 'credit'), 0)
    - coalesce(sum(l.amount_kes) filter (where l.entry_type = 'debit'), 0) as balance_kes,
  count(*) filter (where l.entry_type = 'credit' and l.reason = 'activation_bonus') as schools_credited
from public.partners p
left join public.partner_ledger l on l.partner_id = p.id
group by p.id, p.full_name, p.phone;

grant select on public.partner_ledger_balances to authenticated;
