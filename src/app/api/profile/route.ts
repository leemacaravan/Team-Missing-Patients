import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { SESSION_COOKIE, signSessionToken, verifySessionToken } from '@/lib/auth'
import { serverSupabase } from '@/lib/server-supabase'

export async function PATCH(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await verifySessionToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const nextUser = { ...user, name: body.name ?? user.name, email: body.email ?? user.email }

  if (user.role === 'patient' && user.patientIdentifier) {
    await serverSupabase.from('patients').update({
      first_name: (body.name ?? user.name).split(' ')[0],
      last_name: (body.name ?? user.name).split(' ').slice(1).join(' '),
      email_address: body.email ?? user.email,
    }).eq('patient_identifier', user.patientIdentifier)
  }

  const nextToken = await signSessionToken(nextUser)
  const response = NextResponse.json({ user: nextUser })
  response.cookies.set(SESSION_COOKIE, nextToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  })
  return response
}
