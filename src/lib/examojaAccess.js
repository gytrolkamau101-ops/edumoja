/** ExaMoja Pro entitlement helpers (client). */

function randomCode(len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

function randomPass(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#'
  let s = ''
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

/** Build default credential pack for a school (client-side provisional; server should hash on ExaMoja). */
export function generateCredentialPack(school, { teachers = 5, students = 100 } = {}) {
  const slug = (school?.school_name || 'school')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 12) || 'school'
  const schoolUser = `${slug}.admin`
  const schoolEmail = school?.email || `${slug}@edumoja.local`
  const teacherRows = Array.from({ length: teachers }, (_, i) => ({
    role: 'teacher',
    username: `${slug}.t${i + 1}`,
    password: randomPass(10),
    label: `Teacher ${i + 1}`,
  }))
  return {
    school_username: schoolUser,
    school_email: schoolEmail,
    school_password_plain: randomPass(12),
    join_code: randomCode(8),
    seats_teachers: teachers,
    seats_students: students,
    credentials: [
      {
        role: 'school',
        username: schoolUser,
        email: schoolEmail,
        password: null, // filled below
        label: 'School portal',
      },
      ...teacherRows,
    ],
  }
}

export function fillSchoolPassword(pack) {
  const creds = (pack.credentials || []).map((c) =>
    c.role === 'school' ? { ...c, password: pack.school_password_plain } : c
  )
  return { ...pack, credentials: creds }
}
