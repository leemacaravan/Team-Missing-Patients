import { NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/server-supabase'

export async function POST(request: Request) {
  const { encounters, clinicId } = await request.json()

  console.log('Encounters to insert:', encounters?.length)
  console.log('First encounter:', encounters?.[0])

  if (!Array.isArray(encounters) || encounters.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
  }

  const patientIds = [...new Set(encounters.map((e: any) => e.patient_record_number))]

  let existingQuery = serverSupabase
    .from('encounters')
    .select('patient_record_number, encounter_date, icd_code')
    .in('patient_record_number', patientIds)

  if (clinicId) {
    existingQuery = existingQuery.eq('clinic_id', clinicId)
  }

  const { data: existing } = await existingQuery

  const existingSet = new Set(
    (existing ?? []).map((e: any) =>
      `${e.patient_record_number}${e.encounter_date}${e.icd_code}`
    )
  )

  const newEncounters = encounters.filter((e: any) =>
    !existingSet.has(`${e.patient_record_number}${e.encounter_date}${e.icd_code}`)
  )
  const skipped = encounters.length - newEncounters.length

  if (newEncounters.length === 0) return NextResponse.json({ inserted: 0, skipped })

  const CHUNK = 50
  for (let i = 0; i < newEncounters.length; i += CHUNK) {
    const encounterChunk = newEncounters.slice(i, i + CHUNK)
    const { error } = await serverSupabase
      .from('encounters')
      .insert(encounterChunk)

    console.log('Supabase error:', error)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ inserted: newEncounters.length, skipped })
}
