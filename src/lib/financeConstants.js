/**
 * EduMoja v13 — Kenyan school finance structure (hardcoded codes).
 * Amounts are NOT fixed (budgets change). Codes + streams are fixed for audit-shaped records.
 * Tracking only — EduMoja never holds school fee or capitation money.
 */

/** Income / pot streams (stable ids). */
export const FINANCE_STREAMS = [
  { id: 'capitation', label: 'Capitation (government)', audit: true },
  { id: 'student_fees', label: 'Student / tuition fees', audit: true },
  { id: 'boarding_fees', label: 'Boarding fees', audit: true },
  { id: 'pta_levy', label: 'PTA / activity levy', audit: true },
  { id: 'ng_cdf', label: 'NG-CDF / county bursary', audit: true },
  { id: 'donor', label: 'Donor / NGO', audit: false },
  { id: 'other', label: 'Other school income', audit: false },
  { id: 'in_kind', label: 'In-kind (food / goods)', audit: false },
]

/** FDSE / MoE-style vote heads — codes fixed; labels shown in UI. */
export const CAPITATION_VOTE_HEADS = [
  { code: 'tuition', label: 'Tuition / teaching & learning' },
  { code: 'maintenance', label: 'Maintenance & improvement (RMI)' },
  { code: 'medical', label: 'Medical / insurance (EduAfya)' },
  { code: 'activity', label: 'Activity / co-curricular' },
  { code: 'smasse', label: 'SMASSE' },
  { code: 'textbooks', label: 'Textbooks / learning materials' },
  { code: 'other', label: 'Other vote heads' },
]

/** Operational spend categories (expenses / outflows — not only capitation). */
export const SPEND_CATEGORIES = [
  ...CAPITATION_VOTE_HEADS.map((v) => v.label),
  'Support staff wages',
  'Electricity / water',
  'Environment & sanitation',
  'Local transport',
  'Meals / feeding',
  'Assessments & exams',
  'BOM / capacity building',
  'Other',
]

/** Legacy SchoolFinance source_type ids → stream id */
export const SOURCE_TO_STREAM = {
  capitation: 'capitation',
  pta: 'pta_levy',
  donor: 'donor',
  cdf: 'ng_cdf',
  other_income: 'other',
  in_kind: 'in_kind',
  expense: 'other',
  fees: 'student_fees',
  boarding: 'boarding_fees',
}

export function voteHeadLabel(codeOrLabel) {
  if (!codeOrLabel) return ''
  const hit = CAPITATION_VOTE_HEADS.find(
    (v) => v.code === codeOrLabel || v.label === codeOrLabel
  )
  return hit ? hit.label : String(codeOrLabel)
}

export function streamLabel(id) {
  return FINANCE_STREAMS.find((s) => s.id === id)?.label || id || '—'
}

/** Disclaimer on every finance export */
export const FINANCE_DISCLAIMER =
  'Records only — EduMoja does not hold school funds. Bank / Paybill / cash stay with the school.'
