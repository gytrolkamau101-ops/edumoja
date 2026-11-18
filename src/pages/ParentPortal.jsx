import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from '../components/ui'
import { planEntitlements } from '../lib/plans'
import { letterFromMarks, loadActiveBands } from '../lib/gradeScale'
import { LOGO_HERO, BRAND_NAME } from '../brand'
import { analyseReport, analysisHtml } from '../lib/reportAnalysis'

function formatPostBody(body) {
  if (body == null) return ''
  if (typeof body === 'string') {
    let s = body.trim().replace(/\\n/g, '\n')
    if (s.startsWith('{')) {
      try {
        return formatPostBody(JSON.parse(s))
      } catch (_) {
        return s
      }
    }
    return s
  }
  if (typeof body === 'object') {
    if (body.text != null && String(body.text).trim()) return String(body.text).replace(/\\n/g, '\n').trim()
    if (body.message != null) return String(body.message).trim()
    if (Array.isArray(body.lines)) return body.lines.join('\n')
    if (body.summary) return String(body.summary)
    return ''
  }
  return String(body)
}

function parseBody(raw) {
  if (raw == null) return {}
  if (typeof raw === 'object') return raw
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch (_) {
      return { text: raw }
    }
  }
  return {}
}

function downloadText(filename, title, bodyText, schoolName) {
  const content = [schoolName || BRAND_NAME, title || 'Document', '─'.repeat(36), bodyText || '', '', `Generated ${new Date().toLocaleString()}`].join('\n')
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'document.txt'
  a.click()
  URL.revokeObjectURL(url)
}

function openPrintableReport({ schoolName, logo, learner, adm, meta, subjects, average, avgLetter, scale, analysis }) {
  const a = analysis || analyseReport(subjects || [], { learnerName: learner })
  const rows = (subjects || [])
    .map((s) => {
      const name = s.subject || s.name || '—'
      const weak = (a.improve || []).some((x) => x.subject === name)
      const strong = (a.strengths || []).some((x) => x.subject === name)
      const bg = weak ? 'background:#fff7ed' : strong ? 'background:#f0fdf4' : ''
      return `<tr style="${bg}"><td style="padding:8px;border:1px solid #cbd5e1">${name}</td><td style="padding:8px;border:1px solid #cbd5e1;text-align:center">${s.marks ?? '—'}</td><td style="padding:8px;border:1px solid #cbd5e1;text-align:center">${s.grade ?? '—'}</td></tr>`
    })
    .join('')
  const avgShow = a.average != null ? a.average : average
  const band = a.avgBand || { code: avgLetter || '—', label: '' }
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Report card</title>
    <style>
      body{font-family:system-ui,Segoe UI,sans-serif;color:#0f172a;padding:24px;max-width:720px;margin:0 auto}
      .logo{width:56px;height:56px;object-fit:contain;margin:0 auto;display:block}
      h1{text-align:center;font-size:18px;margin:8px 0 4px}
      .sub{text-align:center;font-size:12px;color:#475569}
      .learner{text-align:center;font-size:16px;font-weight:800;margin:16px 0 4px}
      table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}
      th{background:#f1f5f9;padding:8px;border:1px solid #cbd5e1;text-align:left}
      .foot{font-size:11px;color:#64748b;margin-top:12px}
      @media print{button{display:none}}
    </style></head><body>
    ${logo ? `<img class="logo" src="${logo}" alt=""/>` : ''}
    <h1>${schoolName || ''}</h1>
    <p class="sub">${meta || ''}</p>
    <p class="learner">${learner || ''} · Adm ${adm || '—'}</p>
    <table>
      <thead><tr><th>Subject</th><th style="text-align:center">Marks</th><th style="text-align:center">Grade</th></tr></thead>
      <tbody>
        ${rows}
        <tr><td style="padding:8px;border:1px solid #cbd5e1;font-weight:800">Average</td>
        <td colspan="2" style="padding:8px;border:1px solid #cbd5e1;text-align:center;font-weight:800">${avgShow != null ? Number(avgShow).toFixed(1) : '—'} (${band.code}${band.label ? ' — ' + band.label : ''})</td></tr>
      </tbody>
    </table>
    ${analysisHtml(a)}
    <p class="foot">CBC scale: EE Exceeding · ME Meeting · AE Approaching · BE Below Expectation${scale ? ` · Scale: ${scale}` : ''}</p>
    <p class="foot" style="text-align:center">EduMoja</p>
    <p style="text-align:center;margin-top:20px"><button onclick="window.print()">Print / Save PDF</button></p>
    </body></html>`
  const w = window.open('', '_blank')
  if (!w) {
    alert('Allow pop-ups to print or save PDF')
    return
  }
  w.document.write(html)
  w.document.close()
}

function FullReportCard({ card, schoolName, schoolLogo }) {
  const subjects = card.subjects || []
  const analysis =
    card.analysis ||
    analyseReport(subjects, {
      learnerName: card.learner,
      classAverage: card.class_average,
    })
  const avg = analysis.average != null ? analysis.average : card.average
  const avgLetter = analysis.avgBand?.code || card.avg_letter || ''
  const meta = [card.exam_name, card.grade_name, card.term_label].filter(Boolean).join(' · ')
  const downloadBody = [
    schoolName || '',
    card.exam_name || 'Report card',
    `${card.learner} · Adm ${card.admission_no}`,
    meta,
    '',
    'Subject\tMarks\tGrade',
    ...subjects.map((s) => `${s.subject}\t${s.marks ?? '—'}\t${s.grade ?? '—'}`),
    '',
    `Average: ${avg != null ? Number(avg).toFixed(1) : '—'} (${avgLetter} — ${analysis.avgBand?.label || ''})`,
    '',
    'ANALYSIS',
    analysis.narrative || '',
    '',
    'Strengths: ' + (analysis.strengths || []).map((s) => `${s.subject} (${s.marks})`).join(', '),
    'Improve: ' + (analysis.improve || []).map((s) => `${s.subject} (${s.marks})`).join(', '),
  ].join('\n')

  return (
    <article className="rounded-2xl border border-slate-200 bg-white shadow-md overflow-hidden">
      <div className="bg-gradient-to-b from-slate-900 to-slate-800 text-white px-4 py-4 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
          {card.source === 'released' ? 'Official report card' : 'Report card'}
        </p>
        <h3 className="font-black text-lg leading-snug mt-1">{card.exam_name || 'Examination'}</h3>
        {card.grade_name ? <p className="text-sm text-slate-300 mt-0.5">{card.grade_name}</p> : null}
      </div>
      <div className="p-4 sm:p-5 space-y-4">
        <div className="text-center border-b border-slate-100 pb-3">
          <p className="text-xl font-black text-slate-900">{card.learner}</p>
          <p className="text-sm text-slate-500 font-semibold">Adm {card.admission_no || '—'}</p>
          {meta ? <p className="text-xs text-slate-400 mt-1">{meta}</p> : null}
          {avg != null && (
            <div className="mt-3 inline-flex flex-col items-center rounded-2xl bg-slate-50 border border-slate-200 px-5 py-2">
              <p className="text-[10px] font-bold uppercase text-slate-400">Overall average</p>
              <p className="text-3xl font-black text-slate-900 tabular-nums">{Number(avg).toFixed(1)}</p>
              <p className="text-xs font-bold text-emerald-700">
                {analysis.avgBand?.code} — {analysis.avgBand?.label}
              </p>
            </div>
          )}
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-3 font-black text-slate-700 border-b">Subject</th>
                <th className="text-center p-3 font-black text-slate-700 border-b w-20">Marks</th>
                <th className="text-center p-3 font-black text-slate-700 border-b w-20">Grade</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s, i) => {
                const weak = (analysis.improve || []).some((x) => x.subject === s.subject)
                const strong = (analysis.strengths || []).some((x) => x.subject === s.subject)
                return (
                  <tr
                    key={i}
                    className={`border-b border-slate-100 last:border-0 ${weak ? 'bg-orange-50' : strong ? 'bg-emerald-50' : ''}`}
                  >
                    <td className="p-3 font-medium">{s.subject}</td>
                    <td className="p-3 text-center tabular-nums font-semibold">{s.marks ?? '—'}</td>
                    <td className="p-3 text-center font-black">{s.grade ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider px-3 py-2">
            Performance analysis
          </div>
          <div className="p-3 space-y-3 text-sm text-slate-700">
            <p className="leading-relaxed">{analysis.narrative}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
                <p className="text-[10px] font-black uppercase text-emerald-800 mb-1">Strengths</p>
                <ul className="text-xs space-y-1">
                  {(analysis.strengths || []).length ? (
                    analysis.strengths.map((s, i) => (
                      <li key={i}>
                        <strong>{s.subject}</strong> — {s.marks}
                        {s.grade ? ` (${s.grade})` : ''}
                      </li>
                    ))
                  ) : (
                    <li>None highlighted</li>
                  )}
                </ul>
              </div>
              <div className="rounded-lg bg-orange-50 border border-orange-100 p-3">
                <p className="text-[10px] font-black uppercase text-orange-900 mb-1">Areas to improve</p>
                <ul className="text-xs space-y-1">
                  {(analysis.improve || []).length ? (
                    analysis.improve.map((s, i) => (
                      <li key={i}>
                        <strong>{s.subject}</strong> — {s.marks}
                        {s.grade ? ` (${s.grade})` : ''}
                      </li>
                    ))
                  ) : (
                    <li>None highlighted</li>
                  )}
                </ul>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              Tip: set a short weekly practice plan for weaker subjects and review progress on the next assessment.
            </p>
          </div>
        </div>

        <p className="text-[11px] text-slate-500">CBC: EE Exceeding · ME Meeting · AE Approaching · BE Below Expectation</p>
        <p className="text-[10px] text-slate-400">
          {card.source === 'released' ? 'Released by school · ' : 'From school register · '}
          {card.published_at ? new Date(card.published_at).toLocaleString() : ''}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="py-3 rounded-xl text-xs font-black bg-slate-900 text-white"
            onClick={() =>
              downloadText(
                `Report_${String(card.admission_no || 'learner').replace(/\s+/g, '_')}.txt`,
                card.exam_name,
                downloadBody,
                schoolName,
              )
            }
          >
            Download
          </button>
          <button
            type="button"
            className="py-3 rounded-xl text-xs font-black border-2 border-slate-900 text-slate-900"
            onClick={() =>
              openPrintableReport({
                schoolName,
                logo: schoolLogo,
                learner: card.learner,
                adm: card.admission_no,
                meta,
                subjects,
                average: avg,
                avgLetter,
                scale: card.scale,
                analysis,
              })
            }
          >
            Print / PDF
          </button>
        </div>
      </div>
    </article>
  )
}

function FeeBalanceCard({ balance, school, schoolName }) {
  if (!balance) return null
  const owed = balance.balance != null && Number(balance.balance) > 0
  return (
    <article className="rounded-2xl border border-slate-200 bg-white shadow-md overflow-hidden">
      <div className="bg-slate-900 text-white px-4 py-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Fee balance</p>
        <h3 className="font-black text-lg">{schoolName || 'School fees'}</h3>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl border p-3 bg-slate-50">
            <p className="text-[10px] font-bold uppercase text-slate-400">Term fee</p>
            <p className="font-black">KES {Number(balance.term_fee || 0).toLocaleString()}</p>
          </div>
          <div className="rounded-xl border p-3 bg-slate-50">
            <p className="text-[10px] font-bold uppercase text-slate-400">Arrears</p>
            <p className="font-black">KES {Number(balance.arrears || 0).toLocaleString()}</p>
          </div>
          <div className="rounded-xl border p-3 bg-slate-50">
            <p className="text-[10px] font-bold uppercase text-slate-400">Paid</p>
            <p className="font-black text-emerald-700">KES {Number(balance.paid || 0).toLocaleString()}</p>
          </div>
          <div className={`rounded-xl border p-3 ${owed ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
            <p className="text-[10px] font-bold uppercase text-slate-400">Balance</p>
            <p className={`font-black text-lg ${owed ? 'text-red-700' : 'text-emerald-700'}`}>
              {balance.balance == null ? '—' : `KES ${Number(balance.balance).toLocaleString()}`}
            </p>
          </div>
        </div>
        {(school?.mpesa_paybill || school?.mpesa_till) && (
          <div className="rounded-xl border bg-slate-50 p-3 text-sm">
            <p className="text-[10px] font-bold uppercase text-slate-400">Pay to school</p>
            <p className="font-black">Paybill/Till: {school.mpesa_paybill || school.mpesa_till}</p>
            {school.mpesa_account_hint ? <p className="text-xs text-slate-600">{school.mpesa_account_hint}</p> : null}
          </div>
        )}
        <p className="text-[11px] text-slate-500">
          Pay only to the school Paybill/Till above. EduMoja does not collect school fees.
        </p>
      </div>
    </article>
  )
}


function NoticeCard({ post, schoolName }) {
  const text = formatPostBody(post.body)
  return (
    <article className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 pt-3 pb-1">
        <p className="text-[10px] font-bold uppercase text-slate-400">
          {post.published_at ? new Date(post.published_at).toLocaleString() : ''}
        </p>
        <h3 className="font-black text-slate-900">{post.title || post.post_type}</h3>
      </div>
      <pre className="px-4 pb-2 text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{text || '—'}</pre>
      <div className="px-4 pb-4">
        <button
          type="button"
          className="w-full py-2.5 rounded-xl text-xs font-black border-2 border-slate-200"
          onClick={() => downloadText(`${(post.title || 'notice').replace(/\s+/g, '_')}.txt`, post.title, text, schoolName)}
        >
          Download
        </button>
      </div>
    </article>
  )
}

export default function ParentPortal({ session }) {
  const [parent, setParent] = useState(null)
  const [children, setChildren] = useState([])
  const [school, setSchool] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeChild, setActiveChild] = useState(null)
  const [posts, setPosts] = useState([])
  const [liveCards, setLiveCards] = useState([])
  const [feeBalance, setFeeBalance] = useState(null)
  const [dataError, setDataError] = useState('')
  const [tab, setTab] = useState('results')

  const load = useCallback(async () => {
    setLoading(true)
    setDataError('')
    try {
      const { data: p, error: pErr } = await supabase.from('parents').select('*').eq('id', session.user.id).maybeSingle()
      if (pErr) throw pErr
      setParent(p || null)
      if (!p || p.status !== 'active') {
        setChildren([])
        setSchool(null)
        return
      }
      const { data: links, error: lErr } = await supabase
        .from('parent_children')
        .select('id, status, students(*)')
        .eq('parent_id', session.user.id)
        .eq('status', 'approved')
      if (lErr) throw lErr
      const list = (links || [])
        .map((l) => l.students)
        .filter((s) => s && String(s.status || 'Active') === 'Active')
      setChildren(list)
      const sid = list[0]?.school_id || p.school_id
      if (sid) {
        const { data: sc } = await supabase
          .from('schools')
          .select(
            'id, school_name, plan, plan_expires_at, status, is_suspended, mpesa_paybill, mpesa_till, mpesa_phone, fee_payment_instructions, logo_url',
          )
          .eq('id', sid)
          .maybeSingle()
        setSchool(sc || null)
      }
      if (list.length > 0) setActiveChild((cur) => (cur && list.some((c) => c.id === cur) ? cur : list[0].id))
    } catch (e) {
      console.warn(e)
      setDataError(e.message || 'Could not load parent profile')
      setParent(null)
      setChildren([])
    } finally {
      setLoading(false)
    }
  }, [session.user.id])

  useEffect(() => {
    load()
  }, [load])

  const child = useMemo(
    () => children.find((c) => c.id === activeChild) || children[0] || null,
    [children, activeChild],
  )
  const ent = planEntitlements(school || {})
  const schoolOk = school && !school.is_suspended && String(school.status || 'active') !== 'pending'
  // Pro preferred, but do not hard-lock if plan metadata is messy — still try to show data when school is active
  const portalOk = schoolOk && (!!ent.parentPortal || ent.planId === 'full' || ent.planId === 'pro' || ent.planId === 'premium')

  // Posts (optional release channel)
  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!school?.id || !children.length) {
        setPosts([])
        return
      }
      const ids = children.map((c) => c.id)
      const { data, error } = await supabase
        .from('parent_portal_posts')
        .select('id, post_type, title, body, published_at, student_id, is_active')
        .eq('school_id', school.id)
        .eq('is_active', true)
        .order('published_at', { ascending: false })
        .limit(150)
      if (!alive) return
      if (error) {
        console.warn('parent posts', error)
        setPosts([])
        return
      }
      setPosts(
        (data || [])
          .map((row) => ({ ...row, body: parseBody(row.body) }))
          .filter((row) => !row.student_id || ids.includes(row.student_id)),
      )
    })()
    return () => {
      alive = false
    }
  }, [school?.id, children])

  // Live results + fees for active child
  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!school?.id || !child?.id) {
        setLiveCards([])
        setFeeBalance(null)
        return
      }
      try {
        const bands = await loadActiveBands(school.id)
        const { data: results, error: rErr } = await supabase
          .from('exam_results')
          .select('exam_id, subject_id, marks_obtained, grade, exams(id, exam_name, name, exam_date, term_id), subjects(subject_name)')
          .eq('student_id', child.id)
          .eq('school_id', school.id)
        if (rErr) console.warn(rErr)

        const byExam = {}
        ;(results || []).forEach((r) => {
          const exam = r.exams || {}
          const eid = r.exam_id
          if (!byExam[eid]) {
            byExam[eid] = {
              exam_id: eid,
              exam_name: exam.exam_name || exam.name || 'Examination',
              exam_date: exam.exam_date || null,
              term_id: exam.term_id || null,
              subjects: [],
              total: 0,
              count: 0,
            }
          }
          const marks = r.marks_obtained
          const letter = r.grade || letterFromMarks(marks, bands) || ''
          byExam[eid].subjects.push({
            subject: r.subjects?.subject_name || 'Subject',
            marks,
            grade: letter,
          })
          if (marks != null && marks !== '') {
            byExam[eid].total += Number(marks)
            byExam[eid].count += 1
          }
        })

        // Grade name via enrollment
        let gradeName = ''
        try {
          const { data: enr } = await supabase
            .from('student_enrollments')
            .select('grade_id, grades(grade_name), term_id')
            .eq('student_id', child.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          gradeName = enr?.grades?.grade_name || ''
        } catch (_) {}

        const cards = Object.values(byExam)
          .filter((e) => e.subjects.length)
          .map((e) => {
            const avg = e.count ? e.total / e.count : null
            const subjectList = e.subjects.sort((a, b) => String(a.subject).localeCompare(String(b.subject)))
            const learnerName = `${child.first_name || ''} ${child.last_name || ''}`.trim()
            return {
              exam_id: e.exam_id,
              exam_name: e.exam_name,
              grade_name: gradeName,
              term_label: '',
              learner: learnerName,
              admission_no: child.admission_no,
              subjects: subjectList,
              average: avg,
              avg_letter: avg != null ? letterFromMarks(avg, bands) || '' : '',
              published_at: e.exam_date || null,
              source: 'live',
              analysis: analyseReport(subjectList, { learnerName }),
            }
          })
          .sort((a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0))

        if (alive) setLiveCards(cards)

        // Live fee balance
        const [termsRes, paysRes, openingsRes, enrollRes] = await Promise.all([
          supabase.from('terms').select('id, term, year, is_current').eq('school_id', school.id).order('year', { ascending: false }),
          supabase.from('fee_payments').select('amount_paid, term_id').eq('student_id', child.id),
          supabase.from('fee_opening_balances').select('amount, term_id').eq('student_id', child.id),
          supabase
            .from('student_enrollments')
            .select('grade_id, term_id')
            .eq('student_id', child.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ])
        const terms = termsRes?.data || []
        const pays = paysRes?.data || []
        const openings = openingsRes?.data || []
        const enroll = enrollRes?.data || null

        const term = terms.find((t) => t.is_current) || terms[0] || null
        let termFee = 0
        let gradeId = enroll?.grade_id || null
        if (term && !gradeId) {
          const { data: en2 } = await supabase
            .from('student_enrollments')
            .select('grade_id')
            .eq('student_id', child.id)
            .eq('term_id', term.id)
            .maybeSingle()
          gradeId = en2?.grade_id || null
        }
        if (term && gradeId) {
          const { data: fs } = await supabase
            .from('fee_structures')
            .select('total_fee')
            .eq('school_id', school.id)
            .eq('term_id', term.id)
            .eq('grade_id', gradeId)
            .maybeSingle()
          termFee = Number(fs?.total_fee || 0)
        }

        const paid = pays
          .filter((p) => !term || !p.term_id || p.term_id === term?.id)
          .reduce((s, p) => s + Number(p.amount_paid || 0), 0)
        const arrears = (Array.isArray(openings) ? openings : []).reduce((s, o) => s + Number(o?.amount || 0), 0)

        const balance = termFee + arrears - paid
        if (alive) {
          setFeeBalance({
            termFee,
            arrears,
            paid,
            balance: term || termFee || paid || arrears ? balance : null,
            term_label: term ? `Term ${term.term}/${term.year}` : 'Fees',
          })
        }
      } catch (e) {
        console.warn(e)
        if (alive) setDataError(e.message || 'Could not load learner data')
      }
    })()
    return () => {
      alive = false
    }
  }, [school?.id, child?.id])

  const resultCards = useMemo(() => {
    // Only what the principal published (full report cards) — not raw live marks
    const released = posts
      .filter((p) => p.post_type === 'results' && (!p.student_id || p.student_id === child?.id))
      .filter((p) => p.body?.report_kind === 'full_card' || (Array.isArray(p.body?.subjects) && p.body.subjects.length))
      .map((p) => ({
        exam_id: p.body.exam_id || p.id,
        exam_name: p.body.exam_name || p.title,
        grade_name: p.body.grade_name || '',
        term_label: p.body.term_label || '',
        learner: p.body.learner || `${child?.first_name || ''} ${child?.last_name || ''}`.trim(),
        admission_no: p.body.admission_no || child?.admission_no,
        subjects: p.body.subjects || [],
        average: p.body.average,
        avg_letter: p.body.avg_letter || '',
        scale: p.body.scale,
        analysis: p.body.analysis || null,
        class_average: p.body.analysis?.classAverage || p.body.class_average || null,
        published_at: p.published_at,
        source: 'released',
      }))

    const byExam = new Map()
    for (const c of released) {
      const key = c.exam_id || c.exam_name
      if (!byExam.has(key)) byExam.set(key, c)
    }
    return [...byExam.values()].sort((a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0))
  }, [posts, child])

  const notices = posts.filter(
    (p) => p.post_type === 'notice' && (!p.student_id || p.student_id === child?.id),
  )
  const feePosts = posts.filter((p) => p.post_type === 'fees' && (!p.student_id || p.student_id === child?.id))
  const attPosts = posts.filter(
    (p) => p.post_type === 'attendance' && (!p.student_id || p.student_id === child?.id),
  )

  const logout = async () => {
    try {
      await supabase.auth.signOut({ scope: 'global' })
    } catch (_) {
      try {
        await supabase.auth.signOut()
      } catch (_) {}
    }
    window.location.assign('/')
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center overflow-hidden">
        <img src={LOGO_HERO} alt={BRAND_NAME} className="absolute inset-0 w-full h-full object-cover opacity-90" />
        <div className="absolute inset-0 bg-slate-950/55" />
        <div className="relative z-10 flex flex-col items-center gap-3">
          <Spinner dark={false} />
          <p className="text-white text-sm font-bold">Loading parent portal…</p>
        </div>
      </div>
    )
  }

  if (!parent || parent.status !== 'active') {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow border p-6 max-w-md w-full text-center space-y-4">
          <h1 className="text-xl font-black">Parent access</h1>
          <p className="text-slate-600 text-sm">
            {parent?.status === 'suspended'
              ? 'Account suspended. Contact the school.'
              : 'Waiting for the school to approve your parent–learner link.'}
          </p>
          {dataError ? <p className="text-xs text-red-600">{dataError}</p> : null}
          <button type="button" onClick={logout} className="w-full py-3 rounded-xl font-bold border">
            Log out
          </button>
        </div>
      </div>
    )
  }

  if (!schoolOk) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border p-6 max-w-md text-center space-y-3">
          <h1 className="text-xl font-black">{school?.school_name || 'School'}</h1>
          <p className="text-sm text-slate-600">School access is not active. Contact the school office.</p>
          <button type="button" onClick={logout} className="w-full py-3 rounded-xl font-bold bg-slate-900 text-white">
            Log out
          </button>
        </div>
      </div>
    )
  }

  if (!children.length) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border p-6 max-w-md text-center space-y-3">
          <h1 className="text-xl font-black">No linked learner</h1>
          <p className="text-sm text-slate-600">Ask the school to approve your parent–learner link.</p>
          <button type="button" onClick={logout} className="w-full py-3 rounded-xl font-bold bg-slate-900 text-white">
            Log out
          </button>
        </div>
      </div>
    )
  }

  const tabBtn = (id, label) => (
    <button
      key={id}
      type="button"
      onClick={() => setTab(id)}
      className={`flex-1 py-2.5 text-xs font-black rounded-lg border-2 ${
        tab === id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-24">
      <header className="bg-slate-900 text-white px-4 pt-4 pb-5">
        <div className="max-w-lg mx-auto flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Parent portal</p>
            <h1 className="text-lg font-black truncate">{school.school_name}</h1>
            <p className="text-xs text-slate-400 truncate">{parent.full_name || session.user.email}</p>
          </div>
          <button type="button" onClick={logout} className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg border border-white/25">
            Log out
          </button>
        </div>
        {children.length > 1 && (
          <div className="max-w-lg mx-auto mt-3 flex gap-2 overflow-x-auto">
            {children.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveChild(c.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border ${
                  child?.id === c.id ? 'bg-white text-slate-900 border-white' : 'border-white/30 text-white'
                }`}
              >
                {c.first_name || 'Learner'}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="max-w-lg mx-auto px-4 -mt-3 space-y-3">
        <div className="bg-white rounded-2xl shadow border border-slate-200 p-4">
          <p className="text-[10px] font-bold uppercase text-slate-500">Learner</p>
          <p className="text-xl font-black">
            {child?.first_name} {child?.last_name}
          </p>
          <p className="text-sm text-slate-600">Adm {child?.admission_no || '—'}</p>
        </div>

        {!portalOk && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            Full parent portal is a Pro feature. Showing available learner data where allowed.
          </div>
        )}
        {dataError ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{dataError}</div> : null}

        <div className="flex gap-2">
          {tabBtn('results', 'Results')}
          {tabBtn('fees', 'Fees')}
          {tabBtn('home', 'Notices')}
          {tabBtn('attendance', 'Attendance')}
        </div>

        {tab === 'results' && (
          <div className="space-y-4">
            {!resultCards.length ? (
              <div className="bg-white rounded-2xl border p-6 text-center space-y-2">
                <p className="font-black text-slate-900">No published results yet</p>
                <p className="text-sm text-slate-500">
                  Results appear here only after the school publishes them (Principal: Parents portal → Publish results, or Examinations → Report cards → Publish results to parents).
                </p>
              </div>
            ) : (
              <>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 px-1">
                  Latest exams first · {resultCards.length} report{resultCards.length === 1 ? '' : 's'}
                </p>
                {resultCards.map((c) => (
                  <FullReportCard key={c.exam_id || c.exam_name} card={c} schoolName={school.school_name} schoolLogo={school.logo_url} />
                ))}
              </>
            )}
          </div>
        )}

        {tab === 'fees' && (
          <div className="space-y-3">
            <FeeBalanceCard balance={feeBalance} school={school} schoolName={school.school_name} child={child} />
            {feePosts.map((p) => (
              <NoticeCard key={p.id} post={p} schoolName={school.school_name} />
            ))}
            {!feeBalance && !feePosts.length && (
              <div className="bg-white rounded-2xl border p-6 text-sm text-slate-500 text-center">No fee data yet for this learner.</div>
            )}
            {(school.mpesa_paybill || school.mpesa_till) && (
              <div className="rounded-2xl border bg-white p-4 text-sm text-slate-600">
                <p className="text-[10px] font-bold uppercase text-slate-400">Pay school fees to</p>
                <p className="font-black text-slate-900">Paybill/Till: {school.mpesa_paybill || school.mpesa_till}</p>
              </div>
            )}
          </div>
        )}

        {tab === 'home' && (
          <div className="space-y-3">
            {!notices.length ? (
              <div className="bg-white rounded-2xl border p-6 text-sm text-slate-500 text-center">No notices yet.</div>
            ) : (
              notices.map((p) => <NoticeCard key={p.id} post={p} schoolName={school.school_name} />)
            )}
          </div>
        )}

        {tab === 'attendance' && (
          <div className="space-y-3">
            {!attPosts.length ? (
              <div className="bg-white rounded-2xl border p-6 text-sm text-slate-500 text-center">No attendance notes yet.</div>
            ) : (
              attPosts.map((p) => <NoticeCard key={p.id} post={p} schoolName={school.school_name} />)
            )}
          </div>
        )}
      </main>
    </div>
  )
}
