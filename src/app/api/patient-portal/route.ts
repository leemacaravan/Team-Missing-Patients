import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth'
import { serverSupabase } from '@/lib/server-supabase'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await verifySessionToken(token)
  if (!user || user.role !== 'patient' || !user.patientIdentifier) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: patient, error: pErr } = await serverSupabase
    .from('patients')
    .select('id, first_name, last_name, patient_identifier, most_recent_visit_date, clinic_id')
    .eq('patient_identifier', user.patientIdentifier)
    .maybeSingle()

  if (pErr || !patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }

  const encQuery = serverSupabase
    .from('encounters')
    .select('encounter_date')
    .eq('patient_record_number', patient.patient_identifier)
    .order('encounter_date', { ascending: false })
    .limit(1)

  const { data: lastEncounter } = patient.clinic_id
    ? await encQuery.eq('clinic_id', patient.clinic_id).maybeSingle()
    : await encQuery.maybeSingle()

  return NextResponse.json({
    firstName: patient.first_name,
    lastName: patient.last_name,
    patientIdentifier: patient.patient_identifier,
    mostRecentVisitDate: patient.most_recent_visit_date ?? null,
    lastEncounterDate: lastEncounter?.encounter_date ?? null,
  })
}
