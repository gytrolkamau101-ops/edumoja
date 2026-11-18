# EduMoja v18

## Why "School awaiting activation" showed after Pro
AccountGate required `schools.status = active`. Setting plan to `pro` alone left `status = pending`.

## Fix
- `setPlan` on Super Admin: non-free plans set `status=active`, and if no expiry exists, default **90 days** from now.
- AccountGate: if plan is not `free` and not expired and not suspended → allow staff desk even if status string is still pending.

## Unblock existing school (Supabase SQL, one-off)
```sql
update public.schools
set status = 'active',
    is_suspended = false,
    plan = 'pro',
    plan_expires_at = coalesce(plan_expires_at, now() + interval '90 days')
where school_code = 'YOUR_CODE';
```
Then Refresh on the phone.
