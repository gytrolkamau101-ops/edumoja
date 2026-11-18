import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabaseClient'
import { Card, Alert, PageTitle, input, btn, btnGreen } from '../ui'

export default function StaffInbox({ school, user }) {
  const [staff, setStaff] = useState([])
  const [inbox, setInbox] = useState([])
  const [toId, setToId] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!school?.id || !user?.id) return
    const [{ data: users }, { data: msgs, error: me }] = await Promise.all([
      supabase.from('users').select('id, full_name, role, status').eq('school_id', school.id).order('full_name'),
      supabase
        .from('staff_messages')
        .select('id, from_user_id, to_user_id, body, read_at, created_at')
        .eq('school_id', school.id)
        .or(`to_user_id.eq.${user.id},from_user_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(50),
    ])
    if (me && String(me.message || '').includes('does not exist')) {
      setError('Run migrations/040_staff_messages.sql in Supabase to enable staff inbox.')
      return
    }
    setStaff((users || []).filter((u) => u.id !== user.id && (u.status || 'active') === 'active'))
    setInbox(msgs || [])
    // mark received as read
    const unread = (msgs || []).filter((m) => m.to_user_id === user.id && !m.read_at).map((m) => m.id)
    if (unread.length) {
      await supabase.from('staff_messages').update({ read_at: new Date().toISOString() }).in('id', unread)
    }
  }, [school?.id, user?.id])

  useEffect(() => {
    load()
  }, [load])

  const send = async () => {
    setError('')
    setInfo('')
    if (!toId) return setError('Choose a colleague.')
    if (!body.trim()) return setError('Message is empty.')
    setBusy(true)
    const { error: e } = await supabase.from('staff_messages').insert({
      school_id: school.id,
      from_user_id: user.id,
      to_user_id: toId,
      body: body.trim(),
    })
    setBusy(false)
    if (e) return setError(e.message)
    setBody('')
    setInfo('Sent.')
    load()
  }

  const nameOf = (id) => staff.find((s) => s.id === id)?.full_name || (id === user?.id ? 'You' : 'Staff')

  return (
    <div className="space-y-4">
      <PageTitle title="Staff inbox" subtitle="Message teachers, principal, or secretary inside EduMoja" />
      <Alert>{error}</Alert>
      <Alert kind="ok">{info}</Alert>

      <Card title="New message">
        <div className="space-y-2">
          <select className={input} value={toId} onChange={(e) => setToId(e.target.value)}>
            <option value="">Select colleague…</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name} · {s.role}
              </option>
            ))}
          </select>
          <textarea
            className={input + ' min-h-[100px]'}
            placeholder="Write your message…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <button type="button" className={btnGreen} disabled={busy} onClick={send}>
            {busy ? 'Sending…' : 'Send'}
          </button>
        </div>
      </Card>

      <Card title="Recent">
        {!inbox.length ? (
          <p className="text-sm text-slate-500">No messages yet.</p>
        ) : (
          <ul className="space-y-2">
            {inbox.map((m) => {
              const mine = m.from_user_id === user?.id
              return (
                <li
                  key={m.id}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    mine ? 'border-sky-200 bg-sky-50' : m.read_at ? 'border-slate-200 bg-white' : 'border-amber-300 bg-amber-50'
                  }`}
                >
                  <p className="text-[11px] font-bold text-slate-500">
                    {mine ? `To ${nameOf(m.to_user_id)}` : `From ${nameOf(m.from_user_id)}`} ·{' '}
                    {new Date(m.created_at).toLocaleString()}
                  </p>
                  <p className="text-slate-800 mt-0.5 whitespace-pre-wrap">{m.body}</p>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}

/** Unread count for sidebar badge */
export async function fetchStaffUnreadCount(schoolId, userId) {
  if (!schoolId || !userId) return 0
  const { count, error } = await supabase
    .from('staff_messages')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .eq('to_user_id', userId)
    .is('read_at', null)
  if (error) return 0
  return count || 0
}
