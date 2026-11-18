import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../supabaseClient'
import { Card, Scroll, Alert, btnGreen, btnGhost, th, td } from '../../ui'

export default function ParentsTab({ school, user }) {
  const canManage = ['Principal', 'Deputy Principal', 'Secretary'].includes(user?.role)
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busyId, setBusyId] = useState(null)

  const fetchLinks = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('parent_children')
      .select('*, parents(full_name, email, phone, status), students(admission_no, first_name, last_name)')
      .eq('school_id', school?.id)
      .order('created_at', { ascending: false })
    if (err) setError(err.message)
    setLinks(data || [])
    setLoading(false)
  }, [school?.id])

  useEffect(() => {
    fetchLinks()
  }, [fetchLinks])

  const decide = async (link, approve) => {
    setError('')
    setOk('')
    setBusyId(link.id)
    const { error: linkErr } = await supabase
      .from('parent_children')
      .update({ status: approve ? 'approved' : 'rejected' })
      .eq('id', link.id)
    if (!linkErr && approve) {
      await supabase.from('parents').update({ status: 'active' }).eq('id', link.parent_id)
    }
    setBusyId(null)
    if (linkErr) return setError(linkErr.message)
    setOk(approve ? 'Parent approved.' : 'Request rejected.')
    fetchLinks()
  }

  const removeLink = async (link) => {
    if (!canManage) return
    if (!confirm(`Remove link for ${link.parents?.full_name || 'this parent'}? They will lose portal access to this child.`)) return
    setError('')
    setOk('')
    setBusyId(link.id)
    const { error: delErr } = await supabase.from('parent_children').delete().eq('id', link.id)
    setBusyId(null)
    if (delErr) return setError(delErr.message)
    setOk('Parent–child link deleted.')
    fetchLinks()
  }

  return (
    <Card title="Parent portal links" className="!p-0">
      <div className="p-4 space-y-1">
        <p className="text-sm text-slate-600">
          Approve parent sign-ups before they see fee and result data. Delete removes the portal link for that child.
        </p>
      </div>
      <Alert>{error}</Alert>
      <Alert kind="ok">{ok}</Alert>
      {loading ? (
        <p className="p-6 text-slate-600">Loading…</p>
      ) : links.length === 0 ? (
        <p className="p-6 text-slate-600 text-center">No parent links yet</p>
      ) : (
        <Scroll>
          <table className="w-full">
            <thead className="bg-slate-100 border-b">
              <tr>
                <th className={th}>Parent</th>
                <th className={th}>Contact</th>
                <th className={th}>Child</th>
                <th className={th}>Status</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.id} className="border-b">
                  <td className={td}>{l.parents?.full_name || '—'}</td>
                  <td className={td}>
                    <div className="text-xs">{l.parents?.email || '—'}</div>
                    <div className="text-xs text-slate-500">{l.parents?.phone || ''}</div>
                  </td>
                  <td className={td}>
                    {l.students
                      ? `${l.students.admission_no || ''} ${l.students.first_name || ''} ${l.students.last_name || ''}`.trim()
                      : '—'}
                  </td>
                  <td className={td}>
                    <span className="text-xs font-bold uppercase">{l.status || 'pending'}</span>
                  </td>
                  <td className={td}>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {canManage && l.status !== 'approved' && (
                        <button
                          type="button"
                          disabled={busyId === l.id}
                          className={btnGreen + ' !py-1 !px-2 !text-xs'}
                          onClick={() => decide(l, true)}
                        >
                          Approve
                        </button>
                      )}
                      {canManage && l.status === 'pending' && (
                        <button
                          type="button"
                          disabled={busyId === l.id}
                          className={btnGhost + ' !py-1 !px-2 !text-xs'}
                          onClick={() => decide(l, false)}
                        >
                          Reject
                        </button>
                      )}
                      {canManage && (
                        <button
                          type="button"
                          disabled={busyId === l.id}
                          className="text-xs font-bold text-rose-600 px-2 py-1"
                          onClick={() => removeLink(l)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      )}
    </Card>
  )
}
