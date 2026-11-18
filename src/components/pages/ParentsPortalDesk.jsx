import { useState } from 'react'
import { PageTitle } from '../ui'
import ParentPortalPublish from './ParentPortalPublish'
import ParentNotices from './ParentNotices'
import ReportCards from './ReportCards'
import { planEntitlements } from '../../lib/plans'

const chip = (on) =>
  on
    ? 'px-3 py-1.5 rounded-lg text-xs font-black border bg-amber-400 text-amber-950 border-amber-300 shadow'
    : 'px-3 py-1.5 rounded-lg text-xs font-black border bg-sky-600 text-white border-sky-500 hover:bg-sky-500'

/**
 * Principal desk for everything parents see.
 * Publish results = Report cards release (full multi-subject cards).
 * Letters / feed = notices only.
 */
export default function ParentsPortalDesk({ school, user, term }) {
  const ent = planEntitlements(school || {})
  const unlocked = !!ent.parentPortal || ent.planId === 'full' || ent.planId === 'pro'
  const [tab, setTab] = useState('publish-results')

  return (
    <div className="space-y-4">
      <PageTitle
        title="Parents portal"
        subtitle="Publish exam results · parent letters · optional notices"
      />
      {!unlocked ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950 space-y-2">
          <p className="font-black">Pro feature</p>
          <p>
            Publishing to the parents portal is on <strong>Pro</strong>. Upgrade to let parents see report cards and
            letters you release.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
            <p className="font-black">How results reach parents</p>
            <ol className="list-decimal ml-4 mt-1 space-y-1 text-xs sm:text-sm">
              <li>Enter all subject marks under <strong>Examinations → Exams</strong>.</li>
              <li>Open this tab (or Examinations → Report cards).</li>
              <li>Select <strong>class</strong> and <strong>exam</strong>, click <strong>Refresh</strong>.</li>
              <li>Click <strong>Publish results to parents</strong> — each parent sees only their child&apos;s full report card.</li>
            </ol>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={chip(tab === 'publish-results')} onClick={() => setTab('publish-results')}>
              Publish results
            </button>
            <button type="button" className={chip(tab === 'letters')} onClick={() => setTab('letters')}>
              Parent letters
            </button>
            <button type="button" className={chip(tab === 'feed')} onClick={() => setTab('feed')}>
              Notices / feed
            </button>
          </div>
          {tab === 'publish-results' && (
            <div className="space-y-2">
              <p className="text-sm text-slate-600">
                Same tool as Report cards. Use the green <strong>Publish results to parents</strong> button after the class table loads.
              </p>
              <ReportCards school={school} user={user} term={term} embedInParentsPortal />
            </div>
          )}
          {tab === 'letters' && <ParentNotices school={school} user={user} />}
          {tab === 'feed' && <ParentPortalPublish school={school} user={user} />}
        </>
      )}
    </div>
  )
}
