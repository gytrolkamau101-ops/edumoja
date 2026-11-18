import { useState } from 'react'
import { DEFAULT_PLANS, normalizePlanId } from '../lib/plans'
import { paySchoolPlan } from '../lib/intasend'
import { Alert, toast } from './ui'

const inputCls = 'w-full border-2 border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:border-sky-500 outline-none'
const STK_ID = { starter: 'basic', standard: 'premium', full: 'pro', basic: 'basic', premium: 'premium', pro: 'pro' }

/**
 * In-dashboard subscribe. Payment is always linked to the logged-in school
 * (server derives school_id from the session — kind: school_subscribe).
 */
export default function SubscribeModal({ school, user, onClose, pricing }) {
  const plans = (pricing?.plans?.length ? pricing.plans : DEFAULT_PLANS.plans).filter(
    (p) => Number(p.price) > 0,
  )
  const [planId, setPlanId] = useState(plans.find((p) => p.highlight)?.id || plans[0]?.id || 'standard')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState(user?.email || school?.email || '')
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const selected = plans.find((p) => p.id === planId) || plans[0]
  const current = normalizePlanId(school?.plan || school?.plan_id)

  const send = async (e) => {
    e?.preventDefault?.()
    setError('')
    setInfo('')
    if (!agreed) {
      setError('Please accept the Terms & Conditions to continue.')
      return
    }
    if (!school?.id) {
      setError('No school on this account.')
      return
    }
    setBusy(true)
    try {
      const stkPlanId = STK_ID[selected?.id] || normalizePlanId(selected?.id) || selected?.id
      const result = await paySchoolPlan({
        planId: stkPlanId,
        phone,
        email: email || undefined,
      })
      const msg =
        result.message ||
        `STK sent for ${selected?.name} (KES ${result.amount || selected?.price}). Enter your M-Pesa PIN. This school upgrades when payment completes.`
      setInfo(msg)
      toast('STK sent — check your phone', 'ok')
    } catch (err) {
      let m = err?.message || 'Could not start STK'
      if (/404|function not found|localhost|Netlify functions do not run/i.test(m)) {
        m =
          'STK only works on the live site (edumoja.netlify.app), not Termux/localhost. Deploy v38 to Netlify, open the live URL, then Subscribe. Optional: set VITE_FUNCTIONS_BASE=https://edumoja.netlify.app in .env and rebuild.'
      }
      setError(m)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm" onClick={() => !busy && onClose?.()} />
      <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-3 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 border-b border-amber-300">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-950/70">Subscribe</p>
            <h2 className="text-lg font-black text-amber-950 truncate">{school?.school_name || 'Your school'}</h2>
          </div>
          <button
            type="button"
            onClick={() => !busy && onClose?.()}
            className="w-10 h-10 rounded-full bg-amber-950/10 text-amber-950 font-black text-lg"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={send} className="p-4 sm:p-5 space-y-3">
          <p className="text-xs text-slate-600">
            Platform subscription only. School fees stay on your Paybill/Till — EduMoja never holds learner money.
            {current ? (
              <span className="block mt-1 font-semibold text-slate-800">
                Current plan: <span className="uppercase">{current}</span>
              </span>
            ) : null}
          </p>

          <div className="space-y-2">
            {plans.map((p) => {
              const on = p.id === planId
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlanId(p.id)}
                  className={`w-full text-left rounded-xl border-2 p-3 transition ${
                    on
                      ? 'border-amber-400 bg-amber-50 shadow-[0_0_0_1px_rgba(251,191,36,0.4),0_0_16px_rgba(56,189,248,0.2)]'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-baseline gap-2">
                    <span className="font-black text-slate-900">{p.name}</span>
                    <span className="font-black text-slate-900 whitespace-nowrap">
                      KES {Number(p.price).toLocaleString()}
                      <span className="text-[10px] font-bold text-slate-500"> / {p.period || 'term'}</span>
                    </span>
                  </div>
                  <ul className="mt-1.5 text-[11px] text-slate-600 list-disc pl-4 space-y-0.5">
                    {(p.features || []).map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </button>
              )
            })}
          </div>

          <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span>
              I have read and agree to the <strong>Terms &amp; Conditions</strong>. School fees are paid to each
              school; EduMoja only bills platform subscriptions.
            </span>
          </label>

          <label className="block text-xs font-bold text-slate-700">
            Email
            <input
              className={inputCls}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@school.ac.ke"
            />
          </label>
          <label className="block text-xs font-bold text-slate-700">
            M-Pesa number
            <input
              className={inputCls}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07XXXXXXXX"
              required
            />
          </label>

          {error ? <Alert kind="error">{error}</Alert> : null}
          {info ? <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">{info}</p> : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3.5 rounded-xl text-sm font-black text-white bg-gradient-to-b from-emerald-400 to-emerald-700 shadow-[0_4px_0_#065f46] disabled:opacity-50"
          >
            {busy
              ? 'Sending STK…'
              : `Send M-Pesa STK · KES ${Number(selected?.price || 0).toLocaleString()}`}
          </button>
          <p className="text-[10px] text-center text-slate-400">
            Live site required for STK (Netlify functions). Localhost / Termux will show a clear setup message.
          </p>
        </form>
      </div>
    </div>
  )
}
