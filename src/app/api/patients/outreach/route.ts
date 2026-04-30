import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth'
import { serverSupabase } from '@/lib/server-supabase'

export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await verifySessionToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { id?: string; ids?: string[]; status: string }
  const { id, ids, status } = body

  if (!status || !['contacted', 'pending'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const targetIds = ids ?? (id ? [id] : [])
  if (targetIds.length === 0) return NextResponse.json({ error: 'No patient id(s)' }, { status: 400 })

  let query = serverSupabase
    .from('patients')
    .update({ outreach_status: status })
    .in('id', targetIds)

  if (user.clinicId) query = query.eq('clinic_id', user.clinicId)

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, count: targetIds.length })
}
