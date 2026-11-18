# EduMoja v15

## Activation (hardcoded product rule)
1. School signs up → `schools.status = pending`, plan `free`, no expiry.
2. Super Admin opens Schools → **Activate 30d / 90d / 180d** with plan basic|premium|pro|trial.
3. RPC `admin_activate_school` sets `status=active`, `plan`, `plan_expires_at = now()+days`, `activated_at`.
4. Countdown UI uses `plan_expires_at` (already on dashboard).
5. **Pause** stores remaining days; **Resume** restarts the clock from remaining days.

## Account gate
- Staff user active but school `pending` → “School awaiting activation”.
- School suspended → “School access paused”.

## Partner virtual escrow
- Not a bank account: internal ledger credits (`partner_ledger`).
- On first activation of a partner-linked school → one-time `activation_bonus` credit (from partner_payout_config).
- Cash-out still only via Super Admin **partner payout events** (approve → pay outside system → mark paid).
- Lifetime % commission can post further `credit` rows later; never auto-send M-Pesa from ledger alone.

## Create account
- Still requires valid referral code for new schools (DB).
- Email confirmation may block session until link clicked — that is Supabase Auth, not a dead button.
- After signup, principal sees activation waiting screen until you Activate.

## Deploy SQL
Run `migrations/042_v15_activation_escrow.sql` in Supabase SQL editor.
