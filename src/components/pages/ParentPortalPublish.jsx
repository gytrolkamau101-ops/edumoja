import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import { Card, Alert, input, btn, btnGreen, btnGhost, th, td, Scroll, toast } from '../ui'
import { canEditData } from '../../lib/roles'

/**
 * School staff: publish / recall content on the Pro parent portal.
 * Parents only see is_active posts.
 */
export default function ParentPortalPublish({ school, user }) {
  const [posts, setPosts] = useState([])
  const [students, setStudents] = useState([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [postType, setPostType] = useState('notice')
  const [studentId, setStudentId] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const can = canEditData(user?.role) || user?.role === 'Secretary' || user?.role === 'Senior Teacher'

  const load = async () => {
    if (!school?.id) return
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase
        .from('parent_portal_posts')
        .select('id, post_type, title, body, published_at, is_active, student_id')
        .eq('school_id', school.id)
        .order('published_at', { ascending: false })
        .limit(40),
      supabase
        .from('students')
        .select('id, first_name, last_name, admission_no')
        .eq('school_id', school.id)
        .eq('status', 'Active')
        .order('first_name')
        .limit(500),
    ])
    setPosts(p || [])
    setStudents(s || [])
  }

  useEffect(() => {
    load()
  }, [school?.id])

  const publish = async () => {
    if (!can) return
    setErr('')
    if (!title.trim() && !body.trim()) {
      setErr('Add a title or message.')
      return
    }
    setBusy(true)
    const { error } = await supabase.from('parent_portal_posts').insert({
      school_id: school.id,
      student_id: studentId || null,
      post_type: postType,
      title: title.trim() || postType,
      body: { text: (body.trim() || title.trim()) },
      published_by: user?.id,
      is_active: true,
    })
    setBusy(false)
    if (error) {
      setErr(error.message + (error.message.includes('parent_portal_posts') ? ' — Run SQL 046 in Supabase.' : ''))
      return
    }
    toast('Posted to parent portal', 'ok')
    setTitle('')
    setBody('')
    load()
  }

  const recall = async (id) => {
    const { error } = await supabase.from('parent_portal_posts').update({ is_active: false }).eq('id', id)
    if (error) toast(error.message, 'err')
    else {
      toast('Recalled from parent portal', 'ok')
      load()
    }
  }

  const remove = async (id) => {
    if (!confirm('Delete this post permanently?')) return
    const { error } = await supabase.from('parent_portal_posts').delete().eq('id', id)
    if (error) toast(error.message, 'err')
    else load()
  }

  if (!can) {
    return <p className="text-sm text-slate-600">Only Principal, Deputy, Secretary, or Senior Teacher can publish to parents.</p>
  }

  return (
    <div className="space-y-4">
      <Card title="Publish to parent portal">
        <p className="text-sm text-slate-600 mb-3">
          Parents on Pro only see what you publish here. Unpublish (recall) anytime.
        </p>
        <Alert kind="err">{err}</Alert>
        <div className="grid sm:grid-cols-2 gap-2">
          <select className={input} value={postType} onChange={(e) => setPostType(e.target.value)}>
            <option value="notice">Notice</option>
            <option value="results">Results</option>
            <option value="fees">Fees</option>
            <option value="attendance">Attendance</option>
          </select>
          <select className={input} value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">All linked parents (school-wide)</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.first_name} {s.last_name} ({s.admission_no})
              </option>
            ))}
          </select>
          <input className={`${input} sm:col-span-2`} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea
            className={`${input} sm:col-span-2 min-h-[100px]`}
            placeholder="Message parents will see"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        <button type="button" disabled={busy} onClick={publish} className={`${btnGreen} mt-3`}>
          {busy ? 'Posting…' : 'Post to parent portal'}
        </button>
      </Card>

      <Card title="Published items">
        <Scroll>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className={th}>When</th>
                <th className={th}>Type</th>
                <th className={th}>Title</th>
                <th className={th}>Status</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className={td}>{p.published_at ? new Date(p.published_at).toLocaleString() : ''}</td>
                  <td className={td}>{p.post_type}</td>
                  <td className={td}>{p.title}</td>
                  <td className={td}>{p.is_active ? 'Live' : 'Recalled'}</td>
                  <td className={td}>
                    {p.is_active && (
                      <button type="button" className="text-amber-700 font-bold mr-2" onClick={() => recall(p.id)}>
                        Recall
                      </button>
                    )}
                    <button type="button" className="text-red-600 font-bold" onClick={() => remove(p.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      </Card>
    </div>
  )
}
