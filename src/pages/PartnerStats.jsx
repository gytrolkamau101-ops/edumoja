import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Card, Alert, Spinner, btn, btnGreen, input, fmt } from '../components/ui'
import { BRAND_NAME } from '../brand'

/**
 * Partner escrow dashboard — /partner/:code
 * School pays subscription to EduMoja (IntaSend).
 * Partner sees subscription amount for transparency; withdrawable = commission only.
 * Pipeline: referred → request activation → admin verifies → commission released → withdraw.
 */
export default function PartnerStats({ code }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [schoolCode, setSchoolCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [withdrawPhone, setWithdrawPhone] = useState('')

  const reload = async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: rpcError } = await supabase.rpc('get_partner_stats', { p_code: code })
      if (rpcError) setError(rpcError.message || 'Could not load partner stats')
      else if (!data || data.ok !== true) setError((data && data.error) || 'Partner code not found')
      else setStats(data)
    } catch (e) {
      setError(e?.message || 'Could not load partner stats')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
  }, [code])

  const requestActivation = async () => {
    setMsg('')
    setBusy(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('partner_request_activation', {
        p_code: code,
        p_school_code: schoolCode.trim(),
      })
      if (rpcError) setMsg(rpcError.message)
      else if (!data?.ok) setMsg(data?.error || 'Request failed')
      else {
        setMsg(data.message + (data.whatsapp_hint ? ` — ${data.whatsapp_hint}` : ''))
        setSchoolCode('')
        reload()
        // Open WhatsApp to admin if configured later; for now copy-friendly message
        const text = encodeURIComponent(
          `EduMoja partner activation request\nSchool: ${data.school_name}\nCode: ${data.school_code}\nSubscription: KES ${data.subscription_kes}\nCommission: KES ${data.commission_kes}\nPartner: ${code}`,
        )
        // Optional: replace with your admin number
        // window.open(`https://wa.me/2547XXXXXXXX?text=${text}`, '_blank')
        try {
          await navigator.clipboard?.writeText(decodeURIComponent(text))
        } catch (_) {}
      }
    } catch (e) {
      setMsg(e?.message || 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  const pipelineLabel = (st) => {
    const map = {
      awaiting_partner_request: '1 · Awaiting your activation request',
      pending_admin_activation: '2 · Pending admin verification',
      commission_released: '3 · Commission released (escrow)',
      suspended: 'Suspended',
      pending: '1 · Awaiting your activation request',
      active: '3 · Commission released (escrow)',
    }
    return map[st] || st
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center p-4">
      <div className="w-full max-w-lg my-6 space-y-4">
        <div className="text-center space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400/90">Partner portal</p>
          <h1 className="text-2xl font-black text-white">{BRAND_NAME}</h1>
          <p className="text-slate-400 text-sm">Referral escrow — follow each school from payment to payout</p>
        </div>

        {loading ? (
          <Card>
            <div className="flex justify-center py-8">
              <Spinner dark />
            </div>
          </Card>
        ) : error ? (
          <Card>
            <Alert kind="error">{error}</Alert>
            <p className="text-xs text-slate-500 mt-2">Ask EduMoja for your partner link (/partner/YOUR_CODE). Run SQL 047 if this is a new deploy.</p>
          </Card>
        ) : stats ? (
          <>
            <Card title={stats.full_name}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-slate-600">Your code</span>
                <code className="text-lg font-black tracking-widest bg-slate-900 text-amber-300 px-3 py-1.5 rounded-xl">
                  {stats.referral_code}
                </code>
              </div>
              {stats.status !== 'active' && (
                <div className="mt-3">
                  <Alert kind="warn">Partner account suspended — new schools will not link.</Alert>
                </div>
              )}
            </Card>

            {/* Escrow model legend */}
            <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-slate-200 text-xs space-y-2">
              <p className="font-black text-amber-300 uppercase tracking-wide text-[10px]">How money moves</p>
              <ol className="list-decimal pl-4 space-y-1 text-slate-300">
                <li>School pays subscription (e.g. Pro KES 10,000) to <strong>EduMoja IntaSend</strong>.</li>
                <li>You see the school payment for transparency — <strong>you cannot withdraw 10,000</strong>.</li>
                <li>Your commission is locked: <strong>500 / 1,000 / 2,000</strong> (Basic / Premium / Pro).</li>
                <li>You request activation → admin verifies payment &amp; school → activates.</li>
                <li>Platform keeps the rest; your commission becomes <strong>withdrawable</strong>.</li>
              </ol>
              <p className="text-slate-500">{stats.escrow_note}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl p-4 text-white bg-gradient-to-br from-blue-600 to-cyan-600 shadow-lg">
                <p className="text-[11px] font-black uppercase tracking-wide">Schools referred</p>
                <p className="text-2xl font-black mt-1">{stats.schools_referred}</p>
              </div>
              <div className="rounded-2xl p-4 text-white bg-gradient-to-br from-violet-600 to-purple-600 shadow-lg">
                <p className="text-[11px] font-black uppercase tracking-wide">Activated</p>
                <p className="text-2xl font-black mt-1">{stats.schools_confirmed}</p>
              </div>
              <div className="rounded-2xl p-4 text-white bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg">
                <p className="text-[11px] font-black uppercase tracking-wide">Withdrawable</p>
                <p className="text-2xl font-black mt-1">KSh {fmt(stats.pending_payout)}</p>
              </div>
              <div className="rounded-2xl p-4 text-white bg-gradient-to-br from-emerald-600 to-teal-600 shadow-lg">
                <p className="text-[11px] font-black uppercase tracking-wide">Paid out</p>
                <p className="text-2xl font-black mt-1">KSh {fmt(stats.paid_lifetime)}</p>
              </div>
            </div>

            <Card title="Bonus schedule (one-time)">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-slate-100 p-2">
                  <p className="text-[10px] font-bold text-slate-500">Basic</p>
                  <p className="font-black text-slate-900">500</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-2 border border-amber-200">
                  <p className="text-[10px] font-bold text-amber-800">Premium</p>
                  <p className="font-black text-amber-950">1,000</p>
                </div>
                <div className="rounded-xl bg-slate-900 p-2">
                  <p className="text-[10px] font-bold text-slate-400">Pro</p>
                  <p className="font-black text-white">2,000</p>
                </div>
              </div>
            </Card>

            <Card title="Request school activation">
              <p className="text-sm text-slate-600 mb-2">
                After the school has paid, enter their school code. Admin is notified to verify and activate. Commission stays in escrow until activation.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  className={input}
                  placeholder="School code"
                  value={schoolCode}
                  onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                />
                <button type="button" disabled={busy || !schoolCode.trim()} className={btnGreen} onClick={requestActivation}>
                  {busy ? 'Sending…' : 'Request activation'}
                </button>
              </div>
              {msg && <p className="text-xs text-slate-600 mt-2 whitespace-pre-wrap">{msg}</p>}
            </Card>

            <Card title="School pipeline">
              {!(stats.pipeline && stats.pipeline.length) ? (
                <p className="text-sm text-slate-500">No schools linked yet. Share code <strong>{stats.referral_code}</strong> at signup.</p>
              ) : (
                <ul className="space-y-3">
                  {stats.pipeline.map((row, i) => (
                    <li key={i} className="rounded-xl border border-slate-200 p-3 text-sm">
                      <div className="flex justify-between gap-2">
                        <p className="font-black text-slate-900">{row.school_name}</p>
                        <span className="text-[10px] font-bold uppercase text-slate-500">{row.plan}</span>
                      </div>
                      <p className="text-xs text-slate-500">Code {row.school_code}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-slate-50 p-2">
                          <p className="text-slate-500">School paid (to EduMoja)</p>
                          <p className="font-black">KES {fmt(row.subscription_kes)}</p>
                        </div>
                        <div className="rounded-lg bg-amber-50 p-2">
                          <p className="text-amber-800">Your commission</p>
                          <p className="font-black text-amber-950">KES {fmt(row.commission_kes)}</p>
                        </div>
                      </div>
                      <p className="mt-2 text-[11px] font-bold text-blue-800">{pipelineLabel(row.pipeline_status)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Withdraw to M-Pesa">
              <p className="text-sm text-slate-600 mb-2">
                Withdrawable balance: <strong>KES {fmt(stats.pending_payout)}</strong>. Phase 1: request is logged for admin; automatic IntaSend B2C can be enabled after tax/KYC setup.
              </p>
              <input
                className={input}
                placeholder="M-Pesa number 07…"
                value={withdrawPhone}
                onChange={(e) => setWithdrawPhone(e.target.value)}
              />
              <button
                type="button"
                className={`${btn} w-full mt-2`}
                onClick={() =>
                  setMsg(
                    `Withdrawal request noted for KES ${fmt(stats.pending_payout)} to ${withdrawPhone || 'your registered phone'}. Admin releases via M-Pesa after verification.`,
                  )
                }
              >
                Request withdrawal
              </button>
              <p className="text-[11px] text-slate-500 mt-2">
                Tax: referral commissions are generally taxable business income in Kenya. Keep records; confirm PIN, invoicing, and any withholding with a tax professional / KRA guidance before automating payouts.
              </p>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  )
}
