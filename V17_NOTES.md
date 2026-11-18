# EduMoja v17 — static debug

## Fixed
1. **PremiumGate** said Student fees need Basic — wrong; fees need **Premium** (5k). Capitation message aligned to Premium+.
2. **Login** primary button `type="submit"` so Create account always submits the form.
3. **Attendance** no longer checks legacy `planId === 'pro'`.
4. **ClassSubjectsTab** load does not depend on unstable gradeId closure.
5. **AccountGate** if `schools.status` missing (SQL 042 not run), staff not hard-blocked.

## Verified
- 17 unit tests pass (plans, roles, feeBalances)
- Access matrix: free/basic no fees; premium fees+school-finance; pro library/import
- SuperAdmin activation helpers present

## Still requires ops
- Run `migrations/042_v15_activation_escrow.sql` for pending activation + partner ledger
