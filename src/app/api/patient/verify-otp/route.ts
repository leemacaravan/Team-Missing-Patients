import { NextResponse } from 'next/server'
import { SESSION_COOKIE, signSessionToken } from '@/lib/auth'
import { serverSupabase } from '@/lib/server-supabase'

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits[0] === '1') return digits.slice(1)
  return digits
}

async function findPatientByPhone(normalized: string) {
  const last4 = normalized.slice(-4)
  const { data } = await serverSupabase
    .from('patients')
    .select('id, first_name, last_name, patient_identifier, email_address, clinic_id, home_phone, mobile_phone')
    .or(`home_phone.ilike.%${last4}%,mobile_phone.ilike.%${last4}%`)
    .limit(50)

  return (
    data?.find((p) => {
      const hp = (p.home_phone ?? '').replace(/\D/g, '')
      const mp = (p.mobile_phone ?? '').replace(/\D/g, '')
      return hp === normalized || mp === normalized
    }) ?? null
  )
}

const MAX_ATTEMPTS = 5

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const rawPhone = String(body.phone ?? '').trim()
  const code = String(body.code ?? '').trim()

  if (!rawPhone || !code) {
    return NextResponse.json({ error: 'Phone and code are required' }, { status: 400 })
  }

  const normalized = normalizePhone(rawPhone)
  if (normalized.length !== 10) {
    return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
  }

  const now = new Date().toISOString()

  // Find a matching, unexpired, unused code
  const { data: otpRow } = await serverSupabase
    .from('otp_codes')
    .select('id, code, attempt_count, used')
    .eq('phone', normalized)
    .eq('used', false)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!otpRow) {
    return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 })
  }

  // Check attempt limit
  if ((otpRow.attempt_count ?? 0) >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: 'Too many failed attempts. Please request a new code.' }, { status: 429 })
  }

  if (otpRow.code !== code) {
    // Increment attempt count
    await serverSupabase
      .from('otp_codes')
      .update({ attempt_count: (otpRow.attempt_count ?? 0) + 1 })
      .eq('id', otpRow.id)
    const remaining = MAX_ATTEMPTS - (otpRow.attempt_count ?? 0) - 1
    return NextResponse.json(
      { error: `Invalid code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` },
      { status: 401 }
    )
  }

  // Code is correct — mark as used
  await serverSupabase
    .from('otp_codes')
    .update({ used: true })
    .eq('id', otpRow.id)

  const patient = await findPatientByPhone(normalized)
  if (!patient) {
    return NextResponse.json({ error: 'Patient record not found' }, { status: 404 })
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
