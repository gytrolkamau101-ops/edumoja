import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabaseClient'
import { Card, Alert, btn, btnGreen, btnGhost, PageTitle } from '../ui'
import { hasExaMojaAccess, examojaSeatCaps, planEntitlements } from '../../lib/plans'
import { generateCredentialPack, fillSchoolPassword } from '../../lib/examojaAccess'
import { isLeadership } from '../../lib/roles'

const EXAMOJA_URL = (import.meta.env.VITE_EXAMOJA_URL || 'https://examoja.netlify.app').replace(/\/$/, '')

export default function ExaMojaAccess({ school, user }) {
  const entitled = hasExaMojaAccess(school)
  const caps = examojaSeatCaps(school)
  const ent = planEntitlements(school || {})
  const canManage = isLeadership(user?.role) || user?.role === 'Secretary'

  const [row, setRow] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [reveal, setReveal] = useState(false)

  const load = useCallback(async () => {
    if (!school?.id) return
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase.from('examoja_access').select('*').eq('school_id', school.id).maybeSingle()
    if (err && !String(err.message || '').includes('does not exist')) setError(err.message)
    setRow(data || null)
    setLoading(false)
  }, [school?.id])

  useEffect(() => {
    load()
  }, [load])

  const expiresLabel = row?.plan_expires
    ? new Date(row.plan_expires).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : school?.subscription_ends_at
      ? new Date(school.subscription_ends_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'End of Pro term'

  const provision = async () => {
    if (!canManage || !entitled) return
    setBusy(true)
    setError('')
    setInfo('')
    let pack = generateCredentialPack(school, { teachers: caps.teachers || 5, students: caps.students || 100 })
    pack = fillSchoolPassword(pack)
    const expires = school?.subscription_ends_at || school?.plan_expires || null
    const payload = {
      school_id: school.id,
      plan: 'pro',
      plan_expires: expires,
      seats_teachers: pack.seats_teachers,
      seats_students: pack.seats_students,
      school_email: pack.school_email,
      school_username: pack.school_username,
      school_password_plain: pack.school_password_plain,
      join_code: pack.join_code,
      credentials: pack.credentials,
      active: true,
      updated_at: new Date().toISOString(),
    }
    const { error: err } = await supabase.from('examoja_access').upsert(payload, { onConflict: 'school_id' })
    setBusy(false)
    if (err) {
      setError(
        err.message.includes('does not exist')
          ? 'Run migrations/039_examoja_access.sql in Supabase, then try again.'
          : err.message
      )
      return
    }
    setInfo('ExaMoja seats provisioned. Share passwords only with your staff.')
    setReveal(true)
    load()
  }

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setInfo('Copied.')
    } catch {
      setError('Could not copy — select and copy manually.')
    }
  }

  const copyAll = () => {
    if (!row) return
    const lines = [
      `ExaMoja access — ${school?.school_name || 'School'}`,
      `Valid until: ${expiresLabel}`,
      `Open: ${EXAMOJA_URL}`,
      '',
      `School: ${row.school_username || row.school_email} / ${reveal ? row.school_password_plain : '********'}`,
      `Join code (students): ${row.join_code || '—'}`,
      `Teacher seats: ${row.seats_teachers} · Student seats: ${row.seats_students}`,
      '',
    ]
    ;(row.credentials || []).forEach((c) => {
      if (c.role === 'teacher') {
        lines.push(`${c.label || 'Teacher'}: ${c.username} / ${reveal ? c.password : '********'}`)
      }
    })
    copyText(lines.join('\n'))
  }

  if (!entitled) {
    return (
      <div className="space-y-4">
        <PageTitle>ExaMoja</PageTitle>
        <Card title="Pro benefit">
          <p className="text-sm text-slate-700 leading-relaxed">
            <strong>ExaMoja</strong> is a <em>separate</em> learning app (lessons, quizzes, resources). Anyone can use it by
            subscribing on ExaMoja directly.
          </p>
          <p className="text-sm text-slate-700 leading-relaxed mt-2">
            <strong>EduMoja Pro</strong> includes a time-limited ExaMoja pack for your school (admin + teachers + student
            seats). That pack ends when Pro ends — it does not replace ExaMoja&apos;s own plans.
          </p>
          <p className="text-sm text-slate-600 mt-3">
            Your EduMoja plan: <strong>{ent.planId || 'free'}</strong>
            {ent.expired ? ' (expired)' : ''}. Upgrade to <strong>Pro</strong> for the bundled learning seats.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageTitle
        right={
          <a
            href={EXAMOJA_URL}
            target="_blank"
            rel="noreferrer"
            className={btnGreen + ' !text-sm'}
          >
            Open ExaMoja
          </a>
        }
      >
        ExaMoja access
      </PageTitle>

      <Alert kind="ok">
        EduMoja Pro bundle — ExaMoja seats last until <strong>{expiresLabel}</strong>. When Pro ends, these logins stop working.
      </Alert>
      <Alert>{error}</Alert>
      <Alert kind="ok">{info}</Alert>

      {loading ? (
        <p className="text-slate-600">Loading…</p>
      ) : !row ? (
        <Card title="Provision seats">
          <p className="text-sm text-slate-700 mb-3">
            Create school + teacher logins for ExaMoja ({caps.teachers} teachers, {caps.students} student seats).
            Run SQL <code className="text-xs bg-slate-100 px-1 rounded">039_examoja_access.sql</code> once in Supabase if save fails.
          </p>
          {canManage ? (
            <button type="button" className={btn} disabled={busy} onClick={provision}>
              {busy ? 'Working…' : 'Generate ExaMoja credentials'}
            </button>
          ) : (
            <p className="text-sm text-slate-500">Ask the Principal or Secretary to generate access.</p>
          )}
        </Card>
      ) : (
        <>
          <Card title="School portal">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs font-bold text-slate-500 uppercase">Username</dt>
                <dd className="font-mono font-semibold">{row.school_username}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-slate-500 uppercase">Email</dt>
                <dd className="font-mono text-sm">{row.school_email}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-bold text-slate-500 uppercase">Password</dt>
                <dd className="font-mono font-semibold flex flex-wrap items-center gap-2">
                  {reveal ? row.school_password_plain : '••••••••••••'}
                  <button type="button" className={btnGhost + ' !py-1 !text-xs'} onClick={() => setReveal((v) => !v)}>
                    {reveal ? 'Hide' : 'Reveal'}
                  </button>
                  {reveal && (
                    <button
                      type="button"
                      className={btnGhost + ' !py-1 !text-xs'}
                      onClick={() => copyText(row.school_password_plain || '')}
                    >
                      Copy
                    </button>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-slate-500 uppercase">Student join code</dt>
                <dd className="font-mono font-black text-lg tracking-wider">{row.join_code}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-slate-500 uppercase">Seats</dt>
                <dd>
                  {row.seats_teachers} teachers · {row.seats_students} students
                </dd>
              </div>
            </dl>
          </Card>

          <Card title="Teacher logins" className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 border-b">
                  <tr>
                    <th className="text-left p-2">Label</th>
                    <th className="text-left p-2">Username</th>
                    <th className="text-left p-2">Password</th>
                  </tr>
                </thead>
                <tbody>
                  {(row.credentials || [])
                    .filter((c) => c.role === 'teacher')
                    .map((c) => (
                      <tr key={c.username} className="border-b">
                        <td className="p-2">{c.label}</td>
                        <td className="p-2 font-mono">{c.username}</td>
                        <td className="p-2 font-mono">{reveal ? c.password : '••••••••'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnGhost} onClick={copyAll}>
              Copy summary
            </button>
            {canManage && (
              <button type="button" className={btnGhost} disabled={busy} onClick={provision}>
                Rotate / regenerate
              </button>
            )}
            <a href={EXAMOJA_URL} target="_blank" rel="noreferrer" className={btnGreen}>
              Open ExaMoja
            </a>
          </div>
          <p className="text-xs text-slate-500">
            Students join with the code above inside ExaMoja up to your seat limit. Do not post passwords on public groups.
          </p>
        </>
      )}
    </div>
  )
}
