import { useState } from 'react'
import { supabase } from '../../supabaseClient'
import { Card, Alert, PageTitle, btn, btnGreen, toast } from '../ui'
import { studentTemplate, marksTemplate, feesTemplate, admissionsTemplate, parseCsv } from '../../lib/templates'
import { logAudit } from '../../lib/audit'

export default function ImportCenter({ school, term, user }) {
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  const onFile = async (kind, file) => {
    setError('')
    setInfo('')
    if (!file) return
    const text = await file.text()
    const rows = parseCsv(text)
    if (!rows.length) return setError('No data rows found. Use the template and save as CSV.')
    setBusy(true)
    try {
      if (kind === 'students') await importStudents(rows)
      else if (kind === 'fees') await importFees(rows)
      else if (kind === 'admissions') await importAdmissions(rows)
      else if (kind === 'marks') setInfo('Marks CSV: open Examinations, pick exam/class/subject, or paste marks there. Template is for offline prep.')
    } catch (e) {
      setError(e.message || String(e))
    }
    setBusy(false)
  }

  const importStudents = async (rows) => {
    let ok = 0
    let fail = 0
    const valid = []
    for (const r of rows) {
      if (!r.admission_no || !r.first_name) {
        fail++
        continue
      }
      valid.push({
        school_id: school?.id,
        admission_no: r.admission_no,
        first_name: r.first_name,
        last_name: r.last_name || '',
        gender: r.gender || null,
        date_of_birth: r.date_of_birth || null,
        date_admitted: r.date_admitted || null,
        parent_name: r.parent_name || null,
        parent_phone: r.parent_phone || null,
        parent_email: r.parent_email || null,
        status: r.status || 'Active',
      })
    }
    // Batch the upsert in chunks instead of one request per row — a few
    // hundred sequential round-trips is what was making big CSV imports
    // feel like the page had hung.
    const CHUNK = 200
    for (let i = 0; i < valid.length; i += CHUNK) {
      const chunk = valid.slice(i, i + CHUNK)
      const { error } = await supabase.from('students').upsert(chunk, { onConflict: 'school_id,admission_no' })
      if (error) fail += chunk.length
      else ok += chunk.length
    }
    await logAudit('import.students', 'students', null, { ok, fail })
    setInfo(`Students: ${ok} saved, ${fail} skipped/failed.`)
    toast(`Imported ${ok} students`, 'ok')
  }

  
  const importExamMarks = async (rows) => {
    if (!term) throw new Error('Set a current term before importing exam marks.')
    const { data: students } = await supabase
      .from('students')
      .select('id, admission_no')
      .eq('school_id', school?.id)
    const byAdm = Object.fromEntries((students || []).map((s) => [String(s.admission_no).trim(), s.id]))
    const { data: subjects } = await supabase.from('subjects').select('id, subject_name').eq('school_id', school?.id)
    const bySub = Object.fromEntries((subjects || []).map((s) => [String(s.subject_name).trim().toLowerCase(), s.id]))
    const { data: exams } = await supabase.from('exams').select('id, exam_name, name').eq('school_id', school?.id)
    const byExam = Object.fromEntries((exams || []).map((e) => [String(e.exam_name || e.name || '').trim().toLowerCase(), e.id]))
    let ok = 0
    let fail = 0
    for (const r of rows) {
      const sid = byAdm[String(r.admission_no || '').trim()]
      const subId = bySub[String(r.subject_name || r.subject || '').trim().toLowerCase()]
      const examId = byExam[String(r.exam_name || r.exam || '').trim().toLowerCase()]
      if (!sid || !subId || !examId) {
        fail++
        continue
      }
      const marks = r.marks != null && r.marks !== '' ? Number(r.marks) : null
      const { error } = await supabase.from('exam_results').upsert(
        [{
          school_id: school?.id,
          exam_id: examId,
          student_id: sid,
          subject_id: subId,
          marks,
          grade_label: r.grade_label || r.cbc_band || null,
        }],
        { onConflict: 'exam_id,student_id,subject_id' }
      )
      if (error) {
        // try plain insert if no unique constraint
        const { error: e2 } = await supabase.from('exam_results').insert([{
          school_id: school?.id,
          exam_id: examId,
          student_id: sid,
          subject_id: subId,
          marks,
          grade_label: r.grade_label || r.cbc_band || null,
        }])
        if (e2) fail++
        else ok++
      } else ok++
    }
    await logAudit('import.exam_marks', 'exam_results', null, { ok, fail })
    setInfo(`Exam marks: ${ok} saved, ${fail} skipped/failed.`)
    toast(`Imported ${ok} mark rows`, 'ok')
  }

  const importFees = async (rows) => {
    if (!term) throw new Error('Set a current term before importing fee payments.')
    const { data: students } = await supabase
      .from('students')
      .select('id, admission_no')
      .eq('school_id', school?.id)
    const byAdm = Object.fromEntries((students || []).map((s) => [s.admission_no, s.id]))
    let ok = 0
    let fail = 0
    const valid = []
    for (const r of rows) {
      const sid = byAdm[r.admission_no]
      if (!sid || !r.amount_paid) {
        fail++
        continue
      }
      valid.push({
        school_id: school?.id,
        term_id: term.id,
        student_id: sid,
        amount_paid: Number(r.amount_paid),
        payment_method: r.payment_method || 'Cash',
        receipt_no: r.receipt_no || null,
        payment_date: r.payment_date || new Date().toISOString().slice(0, 10),
        notes: r.notes || 'CSV import',
      })
    }
    const CHUNK = 200
    for (let i = 0; i < valid.length; i += CHUNK) {
      const chunk = valid.slice(i, i + CHUNK)
      const { error } = await supabase.from('fee_payments').insert(chunk)
      if (error) fail += chunk.length
      else ok += chunk.length
    }
    setInfo(`Fee payments: ${ok} saved, ${fail} skipped/failed.`)
    toast(`Imported ${ok} payments`, 'ok')
  }

  const importAdmissions = async (rows) => {
    let ok = 0
    const valid = []
    for (const r of rows) {
      if (!r.full_name) continue
      valid.push({
        school_id: school?.id,
        full_name: r.full_name,
        gender: r.gender || null,
        date_of_birth: r.date_of_birth || null,
        guardian_name: r.guardian_name || null,
        guardian_phone: r.guardian_phone || null,
        applying_grade: r.applying_grade || null,
        status: r.status || 'enquiry',
        notes: r.notes || null,
      })
    }
    const CHUNK = 200
    for (let i = 0; i < valid.length; i += CHUNK) {
      const chunk = valid.slice(i, i + CHUNK)
      const { error } = await supabase.from('admissions').insert(chunk)
      if (!error) ok += chunk.length
    }
    setInfo(`Admissions: ${ok} rows imported.`)
    toast(`Imported ${ok} applications`, 'ok')
  }


  const exportBackup = async () => {
    setError('')
    setInfo('')
    setBusy(true)
    try {
      const sid = school?.id
      if (!sid) throw new Error('No school')
      const tables = [
        ['students', 'id, admission_no, first_name, last_name, gender, date_of_birth, date_admitted, parent_name, parent_phone, parent_email, status'],
        ['student_enrollments', 'student_id, grade_id, term_id'],
        ['grades', 'id, grade_name'],
        ['subjects', 'id, subject_name'],
        ['fee_payments', 'student_id, term_id, amount_paid, payment_method, payment_date, receipt_no, notes'],
        ['fee_structures', 'grade_id, term_id, total_fee'],
        ['fee_opening_balances', 'student_id, term_id, amount'],
        ['attendance', 'student_id, date, status'],
        ['exams', 'id, name, term_id'],
        ['exam_results', 'exam_id, student_id, subject_id, marks'],
        ['school_events', 'event_name, event_date, description'],
        ['staff', 'id, full_name, role, email, status'],
      ]
      const out = { exported_at: new Date().toISOString(), school_id: sid, school_name: school?.school_name, school_code: school?.school_code, tables: {} }
      for (const [table, cols] of tables) {
        try {
          const { data, error } = await supabase.from(table).select(cols).eq('school_id', sid).limit(5000)
          if (!error) out.tables[table] = data || []
          else out.tables[table] = { error: error.message }
        } catch (e) {
          out.tables[table] = { error: String(e.message || e) }
        }
      }
      // users may not have school_id filter same way
      try {
        const { data } = await supabase.from('users').select('id, full_name, email, role, status').eq('school_id', sid)
        out.tables.users = data || []
      } catch (_) {}
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `edumoja_backup_${school?.school_code || 'school'}_${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(a.href)
      setInfo('Full JSON backup downloaded. Keep it offline for re-import after upgrades.')
      toast('Backup downloaded', 'ok')
      await logAudit('export.backup', 'schools', sid, { tables: Object.keys(out.tables) })
    } catch (e) {
      setError(e.message || String(e))
    }
    setBusy(false)
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Import centre" subtitle="Templates, CSV upload, and full school backup export" />
      <Card title="Full school backup (export)">
        <p className="text-sm text-slate-700 mb-3">Download students, fees, exams, attendance, staff and more as one JSON file for safekeeping or future re-import.</p>
        <button type="button" className="px-3 py-1.5 rounded-lg text-xs font-black border bg-sky-600 text-white border-sky-500 hover:bg-sky-500" disabled={busy} onClick={exportBackup}>
          {busy ? 'Exporting…' : 'Download full backup (JSON)'}
        </button>
      </Card>

      <Card title="How to move from Excel / Word">
        <ol className="text-sm text-slate-600 list-decimal pl-5 space-y-2">
          <li>Download a template below (opens in Excel, Google Sheets, or LibreOffice).</li>
          <li>Copy data from your old Excel/Word into the columns. Save as <strong>CSV (UTF-8)</strong>.</li>
          <li>Upload the CSV here. Word tables: paste into Excel first, then save as CSV.</li>
        </ol>
        <p className="text-xs text-slate-500 mt-3">
          Mobile tip: after download, open the file with Excel or Sheets, edit, export CSV, then upload.
        </p>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Students">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} onClick={studentTemplate}>
              Download Excel template
            </button>
            <label className={`${btnGreen} cursor-pointer`}>
              {busy ? 'Working…' : 'Upload CSV'}
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile('students', e.target.files?.[0])} />
            </label>
          </div>
        </Card>
        <Card title="Fee payments">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} onClick={feesTemplate}>
              Download Excel template
            </button>
            <label className={`${btnGreen} cursor-pointer`}>
              Upload CSV
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile('fees', e.target.files?.[0])} />
            </label>
          </div>
        </Card>
        <Card title="Exam marks (bulk CSV)">
          <p className="text-sm text-slate-600 mb-2">Columns: <code>admission_no, exam_name, subject_name, marks, grade_label</code>. Exam and subject names must match Setup.</p>
          <label className={`${btn} inline-block cursor-pointer`}>
            Import exam marks CSV
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              try {
                const text = await f.text()
                const rows = parseCsv(text)
                await importExamMarks(rows)
              } catch (err) {
                setInfo(err.message || String(err))
              }
            }} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} onClick={marksTemplate}>
              Download marks template
            </button>
            <p className="text-xs text-slate-500 w-full">Fill offline, then enter under Examinations (or ask for bulk marks upload next).</p>
          </div>
        </Card>
        <Card title="Admissions">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} onClick={admissionsTemplate}>
              Download template
            </button>
            <label className={`${btnGreen} cursor-pointer`}>
              Upload CSV
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile('admissions', e.target.files?.[0])} />
            </label>
          </div>
        </Card>
      </div>
      <Alert>{error}</Alert>
      <Alert kind="ok">{info}</Alert>
    </div>
  )
}
