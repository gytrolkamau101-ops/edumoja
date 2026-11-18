# v24 Partner escrow model

## Money flow (correct mental model)

```
Parent/School pays Pro KES 10,000
        ↓
   Your IntaSend (EduMoja)
        ↓
  Partner portal shows:
    • Subscription visible: 10,000 (transparency)
    • Commission escrow: 2,500 (only this can become withdrawable)
        ↓
  Partner clicks "Request activation"
        ↓
  pending_admin (+ WhatsApp/clipboard alert to you)
        ↓
  You verify IntaSend payment + school → Activate in Super Admin
        ↓
  Trigger credits partner_ledger 2,500 (once per school)
  Platform keeps 7,500
        ↓
  Partner requests withdraw → you pay M-Pesa (manual first; B2C later)
```

## Bonuses
- Basic 500 · Premium 1,200 · Pro 2,500 · one-time · no lifetime %

## Anti-farm
- One activation_bonus per partner+school
- Commission only after admin Activate (not on signup)
- Prefer Activate only when subscription payment is real
- Optional later: 14-day hold before withdraw

## Tax (not legal advice)
Kenya: commissions are typically taxable. Register obligations with KRA as applicable,
keep ledgers, consider withholding if you become a large payer. Automating IntaSend
payouts does not remove tax duty.
