import { NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/server-supabase'

export async function POST(request: Request) {
  const body = await request.json()
  const { clinic_name, clinic_type, admin_name, email, phone, ehr_system, message } = body

  if (!clinic_name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'Clinic name and email are required.' }, { status: 400 })
  }

  const { error } = await serverSupabase.from('clinic_requests').insert({
    clinic_name: clinic_name.trim(),
    clinic_type: clinic_type || null,
    admin_name: admin_name?.trim() || null,
    email: email.trim().toLowerCase(),
    phone: phone?.trim() || null,
    ehr_system: ehr_system || null,
    message: message?.trim() || null,
    status: 'pending',
  })

  if (error) return NextResponse.json({ error: 'Failed to submit request.' }, { status: 500 })
  return NextResponse.json({ success: true })
}
