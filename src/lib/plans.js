/** Plan matrix — Basic / Premium / Pro (KES 3k / 5k / 10k per term).
 * DB may still store free | trial | basic | premium | pro | starter | standard | full | custom.
 * Normalized to starter | standard | full for entitlements; UI shows Basic / Premium / Pro.
 */

export const PREMIUM_MODULES = [
  'resources',
  'messages',
  'parent-notices',
  'attendance',
  'timetable',
  'circulars',
  'import',
  'support',
  'referrals',
  'records',
  'boarding',
  'transport',
  'bom',
  'staff-desk',
  'games',
  'capitation',
  'finance-analysis',
  'library',
]

/** Hidden from commercial nav (still gated if reached). */
export const NAV_HIDDEN_MODULES = ['games', 'bom', 'records']

/** Pages free / expired schools may open. */
export const FREE_PAGES = ['dashboard', 'students', 'admissions', 'setup']

/** Setup tabs on free (core only). */
export const FREE_SETUP_TABS = ['School identity', 'Terms', 'Grades & Subjects', 'Profile & language']

const CORE = {
  feeStk: false,
  messages: false,
  attendance: false,
  timetable: false,
  circulars: false,
  parentLetters: false,
  import: false,
  boarding: false,
  transport: false,
  bom: false,
  records: false,
  staffDesk: false,
  games: false,
  parentPay: false,
  bulkMessaging: false,
  messageTemplates: false,
  notifyAbsent: false,
  feeHeads: false,
  defaulterBlast: false,
  prioritySupport: false,
  fullBranding: false,
  parentDownloads: false,
  reportWatermark: true,
  capitation: false,
  financeAnalysis: false,
  library: false,
  examoja: false,
  examojaTeachers: 0,
  examojaStudents: 0,
  exams: false,
  fees: false,
  schoolFinance: false,
  parentPortal: false,
  readOnly: false,
}

/** Free / expired — view students + admissions + setup subset. */
const FREE_TIER = {
  ...CORE,
  readOnly: true,
  feeHeads: false,
  fees: false,
  exams: false,
  defaultCap: 80,
  staffCap: 3,
  parentCap: 40,
}

/**
 * Basic — KES 3,000 / term
 * Digital register + day rhythm. No fee ledger write, no school finance desk.
 */
const STARTER_SUITE = {
  ...CORE,
  attendance: true,
  timetable: true,
  exams: true,
  fees: false,
  feeHeads: false,
  schoolFinance: false,
  capitation: false,
  reportWatermark: true,
  parentDownloads: false,
  import: false,
  defaultCap: 150,
  staffCap: 5,
  parentCap: 100,
}

/**
 * Premium — KES 5,000 / term
 * Student fees + school finance tracking + parent contact on balances + comms.
 */
const STANDARD_SUITE = {
  ...STARTER_SUITE,
  fees: true,
  feeHeads: true,
  messages: true,
  circulars: true,
  parentLetters: true,
  bulkMessaging: true,
  messageTemplates: true,
  notifyAbsent: true,
  defaulterBlast: true,
  schoolFinance: true,
  capitation: true,
  import: false,
  parentDownloads: false,
  reportWatermark: true,
  prioritySupport: false,
  parentPortal: false,
  defaultCap: 400,
  staffCap: 15,
  parentCap: 300,
}

/**
 * Pro — KES 10,000 / term
 * Exports, audit term pack (BOM trail), parents portal, library/boarding, ExaMoja.
 */
const FULL_SUITE = {
  ...STANDARD_SUITE,
  import: true,
  parentDownloads: true,
  reportWatermark: false,
  prioritySupport: true,
  fullBranding: true,
  financeAnalysis: true,
  library: true,
  boarding: true,
  transport: true,
  staffDesk: true,
  parentPortal: true,
  feeStk: true,
  examoja: true,
  examojaTeachers: 5,
  examojaStudents: 100,
  defaultCap: 1000,
  staffCap: 40,
  parentCap: 800,
}

/** Trial = Premium features for TRIAL_DAYS, then free. */
const TRIAL_SUITE = {
  ...STANDARD_SUITE,
  timetable: true,
  library: true,
  prioritySupport: false,
  defaultCap: 200,
  staffCap: 10,
  parentCap: 150,
}

export const PLAN_FEATURES = {
  free: { ...FREE_TIER },
  trial: { ...TRIAL_SUITE },
  starter: { ...STARTER_SUITE },
  basic: { ...STARTER_SUITE },
  standard: { ...STANDARD_SUITE },
  premium: { ...STANDARD_SUITE },
  full: { ...FULL_SUITE },
  pro: { ...FULL_SUITE },
  custom: { ...FULL_SUITE },
  termly: { ...STARTER_SUITE },
  yearly: { ...STANDARD_SUITE },
}

/** Normalize DB plan id → canonical commercial id. */
export function normalizePlanId(raw) {
  const id = String(raw || 'free').toLowerCase()
  if (id === 'free') return 'free'
  if (id === 'trial') return 'trial'
  if (id === 'starter' || id === 'basic' || id === 'termly') return 'starter'
  if (id === 'standard' || id === 'premium' || id === 'yearly') return 'standard'
  if (id === 'full' || id === 'pro' || id === 'custom') return 'full'
  return 'starter'
}

export function planEntitlements(school) {
  if (!school || typeof school !== 'object') {
    return { ...FREE_TIER, planId: 'free', expired: false, defaultCap: FREE_TIER.defaultCap }
  }
  const raw = (school?.plan || 'basic').toLowerCase()
  let canonical = normalizePlanId(raw)
  let base = PLAN_FEATURES[raw] || PLAN_FEATURES[canonical] || PLAN_FEATURES.starter
  const cap = school?.student_cap || base.defaultCap

  if (school?.plan_expires_at) {
    const exp = new Date(school.plan_expires_at).getTime()
    if (exp < Date.now()) {
      return {
        ...PLAN_FEATURES.free,
        defaultCap: PLAN_FEATURES.free.defaultCap,
        expired: true,
        planId: 'free',
        wasPlan: canonical,
      }
    }
  }

  if (canonical === 'free' || raw === 'free') {
    return { ...PLAN_FEATURES.free, defaultCap: cap, expired: false, planId: 'free' }
  }
  if (raw === 'trial' || canonical === 'trial') {
    return { ...PLAN_FEATURES.trial, defaultCap: cap, expired: false, planId: 'trial' }
  }

  return { ...base, defaultCap: cap, expired: false, planId: canonical }
}

/** Premium or Pro (comms / fee class features). */
export function isPremium(school) {
  const e = planEntitlements(school)
  if (e.expired || e.planId === 'free') return false
  const id = e.planId || ''
  return id === 'standard' || id === 'full' || id === 'trial' || !!e.messages || !!e.fees
}

/** Pro tier only. */
export function isPro(school) {
  const e = planEntitlements(school)
  if (e.expired || e.planId === 'free') return false
  const id = e.planId || ''
  return id === 'full' || !!e.financeAnalysis || !!e.parentPortal
}

export function canAccessModule(school, moduleId) {
  if (moduleId === 'examoja') {
    const e = planEntitlements(school || {})
    if (!e || e.expired) return false
    return !!(e.planId === 'full' || e.examoja)
  }

  if (moduleId === 'comms-hub') {
    return (
      canAccessModule(school, 'messages') ||
      canAccessModule(school, 'circulars') ||
      canAccessModule(school, 'parent-notices')
    )
  }
  if (moduleId === 'reports-hub') {
    return canAccessModule(school, 'exams') || canAccessModule(school, 'reports')
  }
  if (NAV_HIDDEN_MODULES.includes(moduleId)) return false

  const e = planEntitlements(school)
  if (e.planId === 'free' || e.readOnly) {
    return FREE_PAGES.includes(moduleId)
  }

  // Bug fix: 'parentPortal' (what Sidebar.jsx actually checks, via
  // canAccessModule(school, 'parentPortal')) matched none of the branches
  // below and fell through to the final `return true` — the Parents
  // Portal sidebar item was reachable on every plan, including Free. It's
  // a Pro-only feature per PLAN_FEATURES ('full' plan sets
  // parentPortal: true; Basic/Premium set it false).
  if (moduleId === 'parentPortal' || moduleId === 'parents-portal') {
    return !!e.parentPortal || e.planId === 'full'
  }
  if (moduleId === 'library') return !!e.library || e.planId === 'full' || e.planId === 'trial'
  if (moduleId === 'finance-analysis') return !!e.financeAnalysis || e.planId === 'full'
  if (moduleId === 'boarding' || moduleId === 'transport' || moduleId === 'staff-desk') {
    return e.planId === 'full' || !!e[moduleId === 'staff-desk' ? 'staffDesk' : moduleId]
  }
  if (moduleId === 'capitation' || moduleId === 'school-finance') {
    return !!e.schoolFinance || !!e.capitation || e.planId === 'standard' || e.planId === 'full' || e.planId === 'trial'
  }

  if (moduleId === 'resources') return isPremium(school)
  if (PREMIUM_MODULES.includes(moduleId)) {
    if (moduleId === 'messages') return !!e.messages
    if (moduleId === 'parent-notices') return !!(e.parentLetters || e.messages)
    if (moduleId === 'attendance') return !!e.attendance
    if (moduleId === 'timetable') return !!e.timetable || e.planId === 'trial' || e.planId === 'starter'
    if (moduleId === 'circulars') return !!e.circulars
    if (moduleId === 'import') return !!e.import
    if (moduleId === 'support' || moduleId === 'referrals') return isPremium(school)
    if (moduleId === 'boarding') return !!e.boarding
    if (moduleId === 'transport') return !!e.transport
    if (moduleId === 'games') return false
    return isPremium(school)
  }

  if (moduleId === 'finance' || moduleId === 'fees') {
    return !!e.fees || e.planId === 'standard' || e.planId === 'full' || e.planId === 'trial'
  }
  if (moduleId === 'exams' || moduleId === 'reports') return !!e.exams || e.planId !== 'free'

  return true
}

/** CSV / PDF exports — Pro only. */
export function canExportReports(school) {
  const e = planEntitlements(school)
  if (e.expired || e.planId === 'free' || e.readOnly) return false
  return e.planId === 'full'
}

/** School finance desk — Premium+. Detailed BOM/export depth — Pro. */
export function canDetailedSchoolFinance(school) {
  const e = planEntitlements(school)
  if (e.expired || e.planId === 'free' || e.readOnly) return false
  return e.planId === 'full' || e.planId === 'standard' || e.planId === 'trial'
}

export function canSchoolFinance(school) {
  return canDetailedSchoolFinance(school)
}

export const TRIAL_DAYS = 30

export const DEFAULT_PLANS = {
  currency: 'KES',
  billing: 'termly',
  plans: [
    {
      id: 'starter',
      name: 'Basic',
      price: 3000,
      period: 'per term',
      features: [
        'Students, admissions & school setup',
        'Attendance & timetable',
        'Simple exams path',
        'Watermark on prints',
      ],
    },
    {
      id: 'standard',
      name: 'Premium',
      price: 5000,
      period: 'per term',
      highlight: true,
      features: [
        'Everything in Basic',
        'Student fees & balances',
        'School finance + capitation tracking',
        'Messages · circulars · arrears contact',
      ],
    },
    {
      id: 'full',
      name: 'Pro',
      price: 10000,
      period: 'per term',
      features: [
        'Everything in Premium',
        'CSV/PDF exports · no watermark',
        'BOM approval trail · audit term pack',
        'Parents portal · library · boarding · ExaMoja',
        'School fee STK (school\'s own IntaSend — fees stay with school)',
      ],
    },
  ],
}

export function isModuleInNav(moduleId) {
  return !NAV_HIDDEN_MODULES.includes(moduleId)
}

export function isPremiumOrPro(school) {
  return isPremium(school) || isPro(school)
}

export function hasExaMojaAccess(school) {
  const e = planEntitlements(school || {})
  if (!e || e.expired) return false
  return e.planId === 'full' || !!e.examoja
}

export function examojaSeatCaps(school) {
  const e = planEntitlements(school || {})
  return {
    teachers: e.examojaTeachers || (e.planId === 'full' ? 5 : 0),
    students: e.examojaStudents || (e.planId === 'full' ? 100 : 0),
  }
}

/** Display label for UI — street names Basic / Premium / Pro. */
export function planDisplayName(schoolOrId) {
  const id =
    typeof schoolOrId === 'string'
      ? normalizePlanId(schoolOrId)
      : planEntitlements(schoolOrId || {}).planId
  if (id === 'free') return 'Free'
  if (id === 'trial') return 'Trial'
  if (id === 'starter') return 'Basic'
  if (id === 'standard') return 'Premium'
  if (id === 'full') return 'Pro'
  return String(id || 'Free')
}
