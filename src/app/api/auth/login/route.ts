import { NextResponse } from 'next/server'
import { SESSION_COOKIE, signSessionToken, type SessionUser } from '@/lib/auth'
import { serverSupabase } from '@/lib/server-supabase'

function buildClinicCredentials() {
  return {
    [process.env.DEMO_CLINIC_1_EMAIL ?? 'general@missingpatients.demo']: {
      password: process.env.DEMO_CLINIC_1_PASSWORD ?? 'general123',
      clinicId: process.env.DEMO_CLINIC_1_ID ?? 'clinic_1',
      staffName: process.env.DEMO_CLINIC_1_NAME ?? 'General Demo Clinic',
    },
    [process.env.DEMO_CLINIC_2_EMAIL ?? 'pediatrics@missingpatients.demo']: {
      password: process.env.DEMO_CLINIC_2_PASSWORD ?? 'pediatrics123',
      clinicId: process.env.DEMO_CLINIC_2_ID ?? 'clinic_pediatrics',
      staffName: process.env.DEMO_CLINIC_2_NAME ?? 'Riverside Pediatric Clinic',
    },
  }
}

type LoginBody = {
  email: string
  password: string
  role: 'admin' | 'patient' | 'clinic'
  patientIdentifier?: string
}

export async function POST(request: Request) {
  const body = (await request.json()) as LoginBody
  const email = body.email?.trim().toLowerCase()
  const password = body.password?.trim()

  if (!password || !body.role) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
  }

  let user: SessionUser | null = null

  if (body.role === 'clinic') {
    if (!email) return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
    const credentials = buildClinicCredentials()
    const account = credentials[email]
    if (account && password === account.password) {
      user = {
        id: `clinic_${account.clinicId}`,
        role: 'admin',
        name: account.staffName,
        email,
        clinicId: account.clinicId,
      }
    }
  } else if (body.role === 'admin') {
    if (!email) return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
    const adminEmail = (process.env.ADMIN_EMAIL ?? 'admin@rpi.edu').toLowerCase()
    const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin123'
    if (email === adminEmail && password === adminPassword) {
      user = { id: 'admin', role: 'admin', name: 'Admin User', email }
    }
  } else {
    const patientIdentifier = body.patientIdentifier?.trim()
    if (!patientIdentifier) {
      return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 })
    }

    const { data } = await serverSupabase
      .from('patients')
      .select('id,first_name,last_name,email_address,patient_identifier,home_phone,mobile_phone')
      .eq('patient_identifier', patientIdentifier)
      .maybeSingle()

    if (data) {
      const phone = (data.mobile_phone || data.home_phone || '').replace(/\D/g, '')
      const last4 = phone.slice(-4)
      const fallbackPassword = process.env.PATIENT_PASSWORD ?? ''
      const validPin = (last4 && password === last4) || (fallbackPassword && password === fallbackPassword)
      if (validPin) {
        user = {
          id: data.id,
          role: 'patient',
          name: `${data.first_name} ${data.last_name}`,
          email: data.email_address ?? (patientIdentifier + '@patient.local'),
          patientIdentifier: data.patient_identifier,
        }
      }
    }
  }

  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const token = await signSessionToken(user)
  const response = NextResponse.json({ user })
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  })
  return response
}
