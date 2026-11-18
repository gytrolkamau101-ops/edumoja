# EduMoja v13

## Goal
Hardcode **Kenyan school finance structure** (streams + MoE-style vote heads + BOM approval trail) and align **Basic / Premium / Pro** at **3,000 / 5,000 / 10,000** per term.

## Pricing (street names)
| Plan | DB id | KES / term |
|------|--------|------------|
| Basic | starter / basic | 3,000 |
| Premium | standard / premium | 5,000 |
| Pro | full / pro | 10,000 |

## Access
- **Free:** students, admissions, setup subset
- **Basic:** + attendance, timetable, exams — no student fee ledger
- **Premium:** + fees, school finance, capitation tracking, messages / circulars
- **Pro:** + CSV/PDF exports, audit term pack, library, boarding, ExaMoja seats

## Finance hardcode
- `src/lib/financeConstants.js` — `FINANCE_STREAMS`, `CAPITATION_VOTE_HEADS`, spend categories
- Capitation forms require vote-head selection
- Spends can record `bom_approved_on` + minute ref
- Term audit pack CSV includes vote-head breakdown + missing BOM count + disclaimer
- **Do not hardcode** gazette shilling rates (22,244 etc.) — only codes/labels

## SQL
Run in Supabase after deploy:
`migrations/041_v13_finance_audit.sql`

## Trust line
EduMoja tracks records only. School Paybill / bank / cash never pass through the platform.
