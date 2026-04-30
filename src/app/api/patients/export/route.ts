import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth'
import { serverSupabase } from '@/lib/server-supabase'

const COLUMNS = [
  'patient_identifier',
  'first_name',
  'last_name',
  'age',
  'days_overdue',
  'urgency_label',
  'outreach_status',
  'home_phone',
  'email_address',
  'most_recent_visit_date',
] as const

type ExportPatient = Record<(typeof COLUMNS)[number], unknown>

function csvCell(v: unknown): string {
  if (v == null) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await verifySessionToken(token)
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const clinicId = user.clinicId
  let query = serverSupabase
    .from('patients')
    .select(COLUMNS.join(','))
    .order('days_overdue', { ascending: false })
  if (clinicId) query = query.eq('clinic_id', clinicId)

  const { data } = await query
  const rows = (data ?? []) as unknown as ExportPatient[]

  const header = COLUMNS.join(',')
  const body = rows.map((p) => COLUMNS.map((col) => csvCell(p[col])).join(',')).join('\n')

  const dateStr = new Date().toISOString().slice(0, 10)
  const filename = `${clinicId ?? 'patients'}-patients-${dateStr}.csv`

  return new Response(`${header}\n${body}`, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Total-Count': String(rows.length),
      'Access-Control-Expose-Headers': 'X-Total-Count',
    },
  })
}
