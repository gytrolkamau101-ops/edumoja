import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import Dashboard from './Dashboard'
import ParentPortal from './ParentPortal'
import SuperAdmin from './SuperAdmin'
import { btn, btnGhost, Spinner } from '../components/ui'

function WaitingScreen({ title, message }) {
  return (
    <div className="min-h-screen sk-mesh-light flex items-center justify-center p-4">
      <div className="sk-glass rounded-2xl shadow-xl p-6 md:p-8 max-w-md w-full text-center space-y-4 sk-animate-in">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white flex items-center justify-center font-black text-lg">
          EM
        </div>
        <h1 className="text-2xl font-black text-slate-900">{title}</h1>
        <p className="text-slate-600 text-sm leading-relaxed">{message}</p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          <button type="button" onClick={() => window.location.reload()} className={btn}>
            Refresh
          </button>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className={`${btnGhost} text-red-600 border-red-200`}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AccountGate({ session }) {
  const [kind, setKind] = useState(null) // 'admin' | 'staff' | 'parent' | 'none'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const uid = session?.user?.id

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!uid) {
        if (alive) {
          setKind('none')
          setLoading(false)
        }
        return
      }
      // Only show blocking spinner on first resolve for this uid
      setError('')
      try {

        // Run lookups separately so one missing table cannot kill the gate
        let adminRow = null
        let staffRow = null
        let parentRow = null

        try {
          const r = await supabase.from('platform_admins').select('id').eq('id', uid).maybeSingle()
          adminRow = r.data
        } catch (_) {}

        try {
          const r = await supabase
            .from('users')
            .select('id, status, school_id')
            .eq('id', uid)
            .maybeSingle()
          staffRow = r.data
        } catch (_) {}

        try {
          const r = await supabase.from('parents').select('id, status').eq('id', uid).maybeSingle()
          parentRow = r.data
        } catch (_) {}

        let schoolRow = null
        if (staffRow?.school_id) {
          try {
            const r = await supabase
              .from('schools')
              .select('id, status, is_suspended, plan, plan_expires_at')
              .eq('id', staffRow.school_id)
              .maybeSingle()
            schoolRow = r.data
          } catch (_) {}
        }

        if (!alive) return

        if (adminRow) setKind('admin')
        else if (parentRow) {
          const st = (parentRow.status || 'active').toLowerCase()
          if (st === 'pending' || st === 'pending_approval') setKind('parent_pending')
          else if (st === 'rejected' || st === 'suspended') setKind('parent_blocked')
          else setKind('parent')
        } else if (staffRow) {
          const st = (staffRow.status || 'active').toLowerCase()
          if (st === 'pending' || st === 'pending_approval') setKind('staff_pending')
          else if (st === 'rejected' || st === 'suspended') setKind('staff_blocked')
          else {
            // School must be activated by platform admin before desk access
            // Missing school row or pre-migration DB → allow staff (legacy)
            if (!schoolRow) {
              setKind('staff')
            } else {
              const sst = String(schoolRow.status || 'active').toLowerCase()
              const sus = !!schoolRow.is_suspended || sst === 'suspended'
              const plan = String(schoolRow.plan || 'free').toLowerCase()
              const paid = plan && plan !== 'free'
              let expired = false
              if (schoolRow.plan_expires_at) {
                expired = new Date(schoolRow.plan_expires_at).getTime() < Date.now()
              }
              // Super Admin set a paid plan → treat as activated even if status forgot to flip
              if (sus) setKind('school_suspended')
              else if (sst === 'pending' && !(paid && !expired)) setKind('school_pending')
              else setKind('staff')
            }
          }
        } else setKind('none')
      } catch (e) {
        if (alive) {
          setError(e?.message || 'Could not load your profile')
          setKind('none')
        }
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [uid])

  if (loading) {
    return (
      <div className="min-h-screen sk-mesh-light flex flex-col items-center justify-center gap-3">
        <Spinner dark />
        <p className="text-slate-600 text-sm font-medium">Loading your account…</p>
      </div>
    )
  }

  if (kind === 'admin') return <SuperAdmin session={session} />
  if (kind === 'parent') return <ParentPortal session={session} />
  if (kind === 'staff') return <Dashboard session={session} />

  if (kind === 'staff_pending' || kind === 'parent_pending') {
    return (
      <WaitingScreen
        title="Awaiting approval"
        message="Your account is waiting for the school to approve it. You can refresh after they activate you, or log out and try again later."
      />
    )
  }
  if (kind === 'school_pending') {
    return (
      <WaitingScreen
        title="School awaiting activation"
        message="Your school registered successfully. Access opens after EduMoja platform activation (plan + valid days). Contact support if this takes longer than expected."
      />
    )
  }
  if (kind === 'school_suspended') {
    return (
      <WaitingScreen
        title="School access paused"
        message="This school account is suspended or paused. The subscription clock is frozen until platform admin resumes access."
      />
    )
  }
  if (kind === 'staff_blocked' || kind === 'parent_blocked') {
    return (
      <WaitingScreen
        title="Account not active"
        message="This account is suspended or was not approved. Contact your school or platform admin."
      />
    )
  }

  return (
    <WaitingScreen
      title="EduMoja"
      message={
        error
          ? error
          : "We could not find a school profile for this login. If you just registered, wait a few seconds and refresh — or log out and sign in again after the school approves you."
      }
    />
  )
}
