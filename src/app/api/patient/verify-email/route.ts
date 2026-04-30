import { NextResponse } from 'next/server'
import { SESSION_COOKIE, signSessionToken } from '@/lib/auth'
import { serverSupabase } from '@/lib/server-supabase'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const email = String(body.email ?? '').trim().toLowerCase()
  const dob = String(body.date_of_birth ?? '').trim() // expected: YYYY-MM-DD

  if (!email || !dob) {
    return NextResponse.json({ error: 'Email and date of birth are required' }, { status: 400 })
  }

  const { data: patient } = await serverSupabase
    .from('patients')
    .select('id, first_name, last_name, patient_identifier, email_address, date_of_birth, clinic_id')
    .ilike('email_address', email)
    .eq('date_of_birth', dob)
    .maybeSingle()

  if (!patient) {
    // Generic message — never reveal whether email or DOB was wrong
    return NextResponse.json(
      { error: 'We could not find a record matching that email and date of birth.' },
      { status: 401 }
    )
  }

  const sessionUser = {
    id: patient.id,
    role: 'patient' as const,
    name: `${patient.first_name} ${patient.last_name}`,
    email: patient.email_address ?? `${patient.patient_identifier}@patient.local`,
    patientIdentifier: patient.patient_identifier,
  }

  const token = await signSessionToken(sessionUser)
  const response = NextResponse.json({ user: sessionUser })
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  })
  return response
}
