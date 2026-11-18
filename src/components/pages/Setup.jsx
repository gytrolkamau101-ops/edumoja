import { useMemo, useState, useEffect } from 'react'
import { PageTitle } from '../ui'
import { canAccessSetup, isLeadership } from '../../lib/roles'
import { planEntitlements, FREE_SETUP_TABS } from '../../lib/plans'
import SchoolIdentityTab from './setup/SchoolIdentityTab'
import TermsTab from './setup/TermsTab'
import GradesSubjectsTab from './setup/GradesSubjectsTab'
import ClassSubjectsTab from './setup/ClassSubjectsTab'
import BasketsTab from './setup/BasketsTab'
import GradingTab from './setup/GradingTab'
import FeeStructureTab from './setup/FeeStructureTab'
import FeeHeadsTab from './setup/FeeHeadsTab'
import CalendarTab from './setup/CalendarTab'
import PaymentSettingsTab from './setup/PaymentSettingsTab'
import PromotionTab from './setup/PromotionTab'
import StaffTab from './setup/StaffTab'
import ParentsTab from './setup/ParentsTab'
import AuditTab from './setup/AuditTab'
import ProfileLangTab from './setup/ProfileLangTab'

const ALL_TABS = [
  { id: 'School identity', group: 'School' },
  { id: 'Terms', group: 'School' },
  { id: 'Calendar', group: 'School' },
  { id: 'Grades & Subjects', group: 'Academic' },
  { id: 'Class subjects', group: 'Academic' },
  { id: 'Baskets', group: 'Academic' },
  { id: 'Grading', group: 'Academic' },
  { id: 'Fee Structure', group: 'Finance' },
  { id: 'Fee heads', group: 'Finance' },
  { id: 'Payments', group: 'Finance' },
  { id: 'People & access', group: 'People' },
  { id: 'Promotion', group: 'People' },
  { id: 'Audit', group: 'System' },
  { id: 'Profile & language', group: 'System' },
]

export default function Setup({ school, term, user, onTermChange }) {
  const role = user?.role
  const ent = planEntitlements(school || {})

  const tabs = useMemo(() => {
    let list = ALL_TABS.filter((t) => {
      if (t.id === 'Audit' || t.id === 'People & access' || t.id === 'Promotion') {
        return isLeadership(role) || role === 'Secretary'
      }
      if (t.id === 'Payments' || t.id === 'Fee Structure' || t.id === 'Fee heads') {
        return isLeadership(role) || role === 'Secretary' || role === 'Finance Officer'
      }
      return canAccessSetup(role)
    })
    if (ent.planId === 'free' || ent.readOnly) {
      list = list.filter((t) => FREE_SETUP_TABS.includes(t.id))
    }
    return list
  }, [role, ent.planId, ent.readOnly])

  const [tab, setTab] = useState(() => tabs[0]?.id || 'School identity')

  useEffect(() => {
    if (tabs.length && !tabs.some((t) => t.id === tab)) setTab(tabs[0].id)
  }, [tabs, tab])

  const active = tabs.some((t) => t.id === tab) ? tab : tabs[0]?.id || 'School identity'
  const activeMeta = ALL_TABS.find((t) => t.id === active)

  if (!canAccessSetup(role) && role !== 'Finance Officer') {
    return (
      <div className="space-y-4">
        <PageTitle title="School Setup" />
        <p className="text-sm text-slate-600">Your role cannot open Setup.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageTitle title="School Setup" subtitle="Identity · classes · fees · staff · term tools" />

      {(ent.planId === 'free' || ent.readOnly) && (
        <p className="text-sm font-semibold text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Free plan: School identity, Terms, and Grades/Subjects only.
        </p>
      )}

      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)] overflow-hidden">
        <div className="flex flex-wrap gap-2 p-3 bg-gradient-to-b from-slate-50 to-white border-b border-slate-100">
          {tabs.map((t) => {
            const on = active === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={
                  on
                    ? 'px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold text-white bg-slate-900 border border-slate-900 shadow-md shadow-slate-900/20'
                    : 'px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                }
              >
                {t.id}
              </button>
            )
          })}
        </div>

        <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between gap-2 bg-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            {activeMeta?.group || 'Setup'} · {active}
          </p>
          <p className="text-[11px] text-slate-400 hidden sm:block">{tabs.length} sections</p>
        </div>

        <div className="p-4 sm:p-6 min-h-[16rem] bg-white">
          {active === 'School identity' && <SchoolIdentityTab school={school} user={user} />}
          {active === 'Terms' && <TermsTab school={school} term={term} onTermChange={onTermChange} />}
          {active === 'Grades & Subjects' && <GradesSubjectsTab school={school} />}
          {active === 'Class subjects' && <ClassSubjectsTab school={school} term={term} user={user} />}
          {active === 'Baskets' && <BasketsTab school={school} />}
          {active === 'Grading' && <GradingTab school={school} />}
          {active === 'Fee Structure' && <FeeStructureTab school={school} term={term} />}
          {active === 'Fee heads' && <FeeHeadsTab school={school} />}
          {active === 'Calendar' && <CalendarTab school={school} />}
          {active === 'Payments' && <PaymentSettingsTab school={school} />}
          {active === 'People & access' && (
            <div className="space-y-8">
              <StaffTab school={school} user={user} />
              <ParentsTab school={school} user={user} />
            </div>
          )}
          {active === 'Promotion' && <PromotionTab school={school} term={term} user={user} />}
          {active === 'Audit' && <AuditTab school={school} />}
          {active === 'Profile & language' && <ProfileLangTab user={user} />}
        </div>
      </div>
    </div>
  )
}
