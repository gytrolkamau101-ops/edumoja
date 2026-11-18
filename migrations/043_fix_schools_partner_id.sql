-- EduMoja v20 fix: migration 042 added a trigger (trg_partner_credit_on_activation)
-- and a signup-time UPDATE that both read/write public.schools.partner_id, but 042
-- never actually added that column to public.schools (it only exists on
-- public.partner_ledger, a different table). Every UPDATE to schools that touches
-- `status` fires the trigger, which fails to even evaluate NEW.partner_id because
-- the column doesn't exist on the row — hence "record \"new\" has no field
-- \"partner_id\"" on every Activate / plan-change / Suspend / Resume click in
-- Super Admin, for every school, not just one.
--
-- Safe to run even if 042 already ran — add column if not exists.

alter table public.schools
  add column if not exists partner_id uuid references public.partners(id) on delete set null;

create index if not exists schools_partner_id_idx on public.schools (partner_id);
