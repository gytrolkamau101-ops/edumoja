import { useState } from 'react'
import { PageTitle } from '../ui'
import Circulars from './Circulars'
import Messaging from './Messaging'
import StaffInbox from './StaffInbox'

const TABS = [
  { id: 'messages', label: 'Messages' },
  { id: 'staff', label: 'Staff inbox' },
  { id: 'notices', label: 'Notices & forms' },
]

const chip = (on) =>
  on
    ? 'px-3 py-1.5 rounded-lg text-xs font-black border bg-amber-400 text-amber-950 border-amber-300 shadow'
    : 'px-3 py-1.5 rounded-lg text-xs font-black border bg-sky-600 text-white border-sky-500 hover:bg-sky-500'

/**
 * School-internal communication only.
 * Parent letters + portal feed live under Pro → Parents portal.
 */
export default function CommunicationsHub(props) {
  const [tab, setTab] = useState('messages')
  return (
    <div className="space-y-4">
      <PageTitle
        title="Communications"
        subtitle="Staff messages · school notices & print forms (internal)"
      />
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} className={chip(tab === t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 sm:p-5">
        {tab === 'messages' && <Messaging {...props} />}
        {tab === 'staff' && <StaffInbox {...props} />}
        {tab === 'notices' && <Circulars {...props} />}
      </div>
      <p className="text-xs text-slate-500">
        <strong>Notices & forms</strong> are school templates (meetings, exam notices, print sheets).
        Letters and results for parents go under <strong>Parents portal</strong> (Pro menu).
      </p>
    </div>
  )
}
