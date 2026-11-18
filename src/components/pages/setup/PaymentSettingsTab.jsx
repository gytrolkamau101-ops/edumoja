import { useState } from 'react'
import { supabase } from '../../../supabaseClient'
import { Card, input, btnGreen, Alert } from '../../ui'

export default function PaymentSettingsTab({ school }) {
  const [paybill, setPaybill] = useState(school?.mpesa_paybill || '')
  const [till, setTill] = useState(school?.mpesa_till || '')
  const [accountHint, setAccountHint] = useState(school?.mpesa_account_hint || '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErr('')
    setMsg('')
    const { error } = await supabase
      .from('schools')
      .update({
        mpesa_paybill: paybill || null,
        mpesa_till: till || null,
        mpesa_account_hint: accountHint || null,
      })
      .eq('id', school.id)
    setSaving(false)
    if (error) setErr(error.message)
    else setMsg('Payment settings saved. Parents see Paybill/Till on the parent portal.')
  }

  return (
    <Card title="Fee payment (Paybill / Till / phone)">
      <form onSubmit={save} className="space-y-3">
        <p className="text-xs text-slate-600">
          Parents pay <strong>your</strong> Paybill or Till. EduMoja does not collect or route school fees — only
          your software subscription is billed via M-Pesa on the dashboard Subscribe button.
        </p>
        <label className="block text-xs font-bold text-slate-700">
          M-Pesa Paybill
          <input className={input} value={paybill} onChange={(e) => setPaybill(e.target.value)} placeholder="e.g. 522522" />
        </label>
        <label className="block text-xs font-bold text-slate-700">
          Till number (optional)
          <input className={input} value={till} onChange={(e) => setTill(e.target.value)} placeholder="e.g. 123456" />
        </label>
        <label className="block text-xs font-bold text-slate-700">
          Account hint for parents
          <input
            className={input}
            value={accountHint}
            onChange={(e) => setAccountHint(e.target.value)}
            placeholder="Use admission number as account reference"
          />
        </label>
        <Alert kind="error">{err}</Alert>
        {msg ? <p className="text-xs font-semibold text-emerald-700">{msg}</p> : null}
        <button type="submit" disabled={saving} className={btnGreen}>
          {saving ? 'Saving…' : 'Save payment settings'}
        </button>
      </form>
    </Card>
  )
}
