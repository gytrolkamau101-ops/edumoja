# EduMoja v22

## Green / teal full screen
Boot splash (`#0f766e` + "EduMoja") while `getSession()` runs. If it never finishes (bad network / stuck SW), v22 clears loading after **10 seconds**.

## Trial locks
Trial = Premium suite: school finance + referrals **unlocked**. Import is **Pro-only** (moved under Pro in sidebar).

## Admin 043 / 044
- **043**: adds `schools.partner_id` so activation trigger does not error.
- **044**: suspend reason + `partner_ledger_balances` view.
Run both in Supabase if Super Admin activate/suspend still errors.

## Moat
`migrations/045_v22_moat_events.sql` + `src/lib/moat.js`. Activation logs `school.activated`.
