import { ToastHost } from './components/ui'
import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Login from './pages/Login'
import ErrorBoundary from './components/ErrorBoundary'
import { LOGO_HERO, BRAND_NAME } from './brand'
import { applyTheme, getTheme } from './lib/prefs'
import AccountGate from './pages/AccountGate'
import PartnerStats from './pages/PartnerStats'
import { input, btn, Alert, PasswordInput, Spinner } from './components/ui'

/** /partner/:code — public, no-login partner dashboard (see PartnerStats.jsx) */
function matchPartnerRoute() {
  if (typeof window === 'undefined') return null
  const m = window.location.pathname.match(/^\/partner\/([^/]+)\/?$/i)
  return m ? decodeURIComponent(m[1]) : null
}

function ResetPassword({ onDone }) {
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setMsg(error.message)
    else onDone()
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <form onSubmit={submit} className="sk-glass rounded-2xl w-full max-w-md p-6 space-y-4 sk-animate-in">
        <h1 className="text-2xl font-bold text-slate-900">Set a new password</h1>
        <PasswordInput
          minLength={6}
          required
          placeholder="New password (min 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Alert>{msg}</Alert>
        <button disabled={busy} className={`${btn} w-full`}>
          {busy ? 'Saving...' : 'Save password'}
        </button>
      </form>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recovering, setRecovering] = useState(false)
  const partnerCode = matchPartnerRoute()

  useEffect(() => {
    applyTheme(getTheme())
    let settled = false
    const bootTimer = setTimeout(() => {
      if (!settled) {
        settled = true
        setLoading(false)
      }
    }, 10000)
    supabase.auth.getSession().then(({ data }) => {
      if (settled) return
      settled = true
      clearTimeout(bootTimer)
      setSession(data.session)
      setLoading(false)
    }).catch(() => {
      if (settled) return
      settled = true
      clearTimeout(bootTimer)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      // TOKEN_REFRESHED / USER_UPDATED must NOT remount the whole tree —
      // that resets Dashboard page state (feels like auto-refresh to home)
      // and aborts gallery/file picks on mobile.
      if (event === 'PASSWORD_RECOVERY') {
        setRecovering(true)
        setSession(s)
        return
      }
      if (event === 'SIGNED_OUT') {
        setSession(null)
        return
      }
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        setSession(s)
        return
      }
      // Keep session user in sync only when uid changes
      setSession((prev) => {
        const prevId = prev?.user?.id
        const nextId = s?.user?.id
        if (prevId && nextId && prevId === nextId) return prev
        return s
      })
    })
    return () => { clearTimeout(bootTimer); data.subscription.unsubscribe() }
  }, [])

  if (partnerCode) {
    return <PartnerStats code={partnerCode} />
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center overflow-hidden">
        <img
          src={LOGO_HERO}
          alt={BRAND_NAME}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-slate-950/50 to-slate-950/80" />
        <div className="relative z-10 flex flex-col items-center gap-4 px-6">
          <span className="sk-spinner !border-white/30 !border-t-white" role="status" aria-label="Loading" />
          <p className="text-white font-black text-lg tracking-wide drop-shadow-lg">{BRAND_NAME}</p>
        </div>
      </div>
    )
  }

  if (session && recovering) return <ResetPassword onDone={() => setRecovering(false)} />
  return (
    <>
      <ToastHost />
      <ErrorBoundary>
      {session ? <AccountGate session={session} /> : <Login />}
    </ErrorBoundary>
    </>
  )
}
