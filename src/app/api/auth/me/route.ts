import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return NextResponse.json({ user: null }, { status: 401 })
  const user = await verifySessionToken(token)
  if (!user) return NextResponse.json({ user: null }, { status: 401 })
  return NextResponse.json({ user })
}
