import { NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/server-supabase'

export async function POST(request: Request) {
  const { patients } = await request.json()
  if (!Array.isArray(patients) || patients.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
  }

  const clinicId = patients[0]?.clinic_id
  const identifiers = patients.map((p: any) => p.patient_identifier).filter(Boolean)

  const { data: existing } = await serverSupabase
    .from('patients')
    .select('patient_identifier')
    .eq('clinic_id', clinicId)
    .in('patient_identifier', identifiers)

  const existingSet = new Set((existing ?? []).map((p: any) => p.patient_identifier))
  const newCount = identifiers.filter((id: string) => !existingSet.has(id)).length
  const updatedCount = identifiers.filter((id: string) => existingSet.has(id)).length

  const { error } = await serverSupabase.from('patients').upsert(patients, { onConflict: 'patient_identifier,clinic_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ inserted: newCount, updated: updatedCount, skipped: 0 })
}
