import { planEntitlements, canAccessModule, planDisplayName } from '../lib/plans'

/**
 * Blocks module UI when the school's plan does not include it.
 * Free plan still sees menu items (lock); this is the page-level message.
 */
export default function PremiumGate({ school, moduleName, children }) {
  const e = planEntitlements(school || {})
  const ok = canAccessModule(school || {}, moduleName)

  if (ok) return children

  const planLabel = planDisplayName(school || {})
  const need = neededPlan(moduleName)
  const title = moduleNameLabel(moduleName)

  return (
    <div className="max-w-lg mx-auto mt-8 rounded-2xl border-2 border-sky-300 bg-gradient-to-br from-sky-50 to-blue-50 p-6 space-y-3 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-sky-700">Plan required</p>
      <h2 className="text-2xl font-black text-slate-900">{title}</h2>
      <p className="text-sm text-slate-700">
        This feature needs <strong>{need}</strong>. Your school is on <strong>{planLabel}</strong>
        {e.expired ? ' (expired / free)' : ''}.
      </p>
      <p className="text-sm text-slate-600">
        {e.planId === 'free' || e.readOnly
          ? 'Upgrade: Basic 3,000 · Premium 5,000 · Pro 10,000 per term.'
          : 'Upgrade your plan or ask Super Admin to activate / extend days.'}
      </p>
      <p className="text-xs font-black uppercase tracking-wide text-amber-700 animate-pulse">
        Upgrade to unlock · {need}
      </p>
    </div>
  )
}

function neededPlan(id) {
  // Pro-only modules
  if (['library', 'finance-analysis', 'boarding', 'transport', 'staff-desk', 'examoja', 'import'].includes(id)) {
    return 'Pro (KES 10,000 / term)'
  }
  // Premium+ (fees, school money, comms). Attendance/timetable also on Basic — gate still OK if unlocked.
  if (
    [
      'finance',
      'fees',
      'messages',
      'parent-notices',
      'circulars',
      'resources',
      'support',
      'referrals',
      'comms-hub',
      'school-finance',
      'capitation',
      'defaulterBlast',
    ].includes(id)
  ) {
    return 'Premium or Pro (KES 5,000+ / term)'
  }
  // Basic+
  if (['exams', 'reports', 'attendance', 'timetable', 'reports-hub'].includes(id)) {
    return 'Basic or higher (KES 3,000+ / term)'
  }
  return 'a higher plan'
}

function moduleNameLabel(id) {
  const map = {
    messages: 'WhatsApp / SMS',
    attendance: 'Attendance',
    timetable: 'Timetable',
    circulars: 'Circulars',
    capitation: 'Capitation',
    'finance-analysis': 'Financial analysis',
    'parent-notices': 'Parent letters',
    parentLetters: 'Parent letters',
    import: 'Import centre',
    support: 'Contact Support',
    referrals: 'Invite · Earn',
    boarding: 'Boarding',
    transport: 'Transport',
    bom: 'BOM portal',
    records: 'Records vault',
    'staff-desk': 'Staff desk',
    games: 'Games',
    resources: 'Resources',
    examoja: 'ExaMoja',
    library: 'Library',
    finance: 'Student fees',
    exams: 'Exams',
    reports: 'Report cards',
    'school-finance': 'School finance',
    'comms-hub': 'Communications',
    'reports-hub': 'Examinations',
  }
  return map[id] || id
}
