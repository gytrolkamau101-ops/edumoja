# EduMoja v1.2

School management SaaS — **Basic · Premium · Pro**.

**Tagline:** One institution. One control.

## ExaMoja (separate product)
ExaMoja runs on its own (student daily plans, school term plans).
**Pro only** adds a bundled ExaMoja seat pack until Pro expires.
See sidebar **PRO → ExaMoja**.

### SQL
Run `migrations/039_examoja_access.sql` for the credentials sheet.
Full auto-provision into the ExaMoja project = payment webhook (production).

## Run
```bash
cp .env.example .env
npm i && npm run dev -- --host 0.0.0.0 --port 5173
```
