/**
 * Shared report-card analysis for school print + parent portal.
 * Pure helpers — no network.
 */

export function cbcBand(pct) {
  const n = Number(pct)
  if (Number.isNaN(n)) return { code: '—', label: 'Not graded' }
  if (n >= 80) return { code: 'EE', label: 'Exceeding Expectation' }
  if (n >= 65) return { code: 'ME', label: 'Meeting Expectation' }
  if (n >= 50) return { code: 'AE', label: 'Approaching Expectation' }
  return { code: 'BE', label: 'Below Expectation' }
}

/**
 * @param {Array<{subject:string, marks:number|null, grade?:string}>} subjects
 * @param {{ classAverage?: number|null, classHigh?: number|null, classLow?: number|null, learnerName?: string }} meta
 */
export function analyseReport(subjects, meta = {}) {
  const scored = (subjects || [])
    .map((s) => ({
      subject: s.subject || s.name || 'Subject',
      marks: s.marks == null || s.marks === '' ? null : Number(s.marks),
      grade: s.grade || '',
    }))
    .filter((s) => s.marks != null && !Number.isNaN(s.marks))

  if (!scored.length) {
    return {
      average: null,
      avgBand: cbcBand(null),
      strengths: [],
      improve: [],
      summary: 'No marks recorded for this examination yet.',
      narrative: '',
      subjectCount: 0,
    }
  }

  const total = scored.reduce((a, s) => a + s.marks, 0)
  const average = Math.round((total / scored.length) * 10) / 10
  const avgBand = cbcBand(average)
  const sortedDesc = [...scored].sort((a, b) => b.marks - a.marks)
  const sortedAsc = [...scored].sort((a, b) => a.marks - b.marks)

  // Strengths: top performers (>=70 or top 2)
  const strengths = sortedDesc.filter((s) => s.marks >= 70).slice(0, 3)
  if (!strengths.length) strengths.push(...sortedDesc.slice(0, 2))

  // Improve: below 50 always; else lowest up to 2 that are below personal average
  let improve = sortedAsc.filter((s) => s.marks < 50).slice(0, 3)
  if (improve.length < 2) {
    const below = sortedAsc.filter((s) => s.marks < average && !improve.some((x) => x.subject === s.subject))
    improve = [...improve, ...below].slice(0, 3)
  }

  const name = meta.learnerName || 'The learner'
  let summary = `${name} attained an average of ${average} (${avgBand.code} — ${avgBand.label}) across ${scored.length} subject${scored.length === 1 ? '' : 's'}.`
  if (meta.classAverage != null && !Number.isNaN(Number(meta.classAverage))) {
    const ca = Number(meta.classAverage)
    const diff = Math.round((average - ca) * 10) / 10
    if (diff > 2) summary += ` This is ${diff} points above the class average of ${ca}.`
    else if (diff < -2) summary += ` This is ${Math.abs(diff)} points below the class average of ${ca}.`
    else summary += ` Performance is close to the class average of ${ca}.`
  }

  const strengthText = strengths.length
    ? `Strong performance in ${strengths.map((s) => `${s.subject} (${s.marks})`).join(', ')}.`
    : ''
  const improveText = improve.length
    ? `Priority areas to strengthen: ${improve.map((s) => `${s.subject} (${s.marks})`).join(', ')}. Focused revision and practice in these subjects is recommended.`
    : 'No major weak subjects identified on this assessment.'

  const narrative = [summary, strengthText, improveText].filter(Boolean).join(' ')

  return {
    average,
    avgBand,
    strengths,
    improve,
    summary,
    narrative,
    subjectCount: scored.length,
    highest: sortedDesc[0],
    lowest: sortedAsc[0],
  }
}

/** HTML block for print / parent portal */
export function analysisHtml(analysis) {
  if (!analysis || analysis.average == null) {
    return `<div style="margin-top:14px;padding:12px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;color:#475569">No analysis available — marks incomplete.</div>`
  }
  const strengthLis = (analysis.strengths || [])
    .map((s) => `<li><strong>${s.subject}</strong> — ${s.marks}${s.grade ? ` (${s.grade})` : ''}</li>`)
    .join('')
  const improveLis = (analysis.improve || [])
    .map((s) => `<li><strong>${s.subject}</strong> — ${s.marks}${s.grade ? ` (${s.grade})` : ''}</li>`)
    .join('')
  return `
  <div style="margin-top:16px;border:1px solid #cbd5e1;border-radius:10px;overflow:hidden">
    <div style="background:#0f172a;color:#fff;padding:10px 14px;font-size:12px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase">Performance analysis</div>
    <div style="padding:12px 14px;font-size:12px;line-height:1.55;color:#0f172a">
      <p style="margin:0 0 10px"><strong>Overall average:</strong> ${analysis.average}
        &nbsp;·&nbsp; <strong>CBC band:</strong> ${analysis.avgBand.code} (${analysis.avgBand.label})</p>
      <p style="margin:0 0 12px">${analysis.narrative}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px">
          <div style="font-size:10px;font-weight:800;color:#166534;text-transform:uppercase;margin-bottom:6px">Strengths</div>
          <ul style="margin:0;padding-left:18px">${strengthLis || '<li>None highlighted</li>'}</ul>
        </div>
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:10px">
          <div style="font-size:10px;font-weight:800;color:#9a3412;text-transform:uppercase;margin-bottom:6px">Areas to improve</div>
          <ul style="margin:0;padding-left:18px">${improveLis || '<li>None highlighted</li>'}</ul>
        </div>
      </div>
      <p style="margin:12px 0 0;font-size:11px;color:#64748b">Guidance: celebrate strengths, set a short weekly practice plan for weaker subjects, and review the next assessment for progress.</p>
    </div>
  </div>`
}
