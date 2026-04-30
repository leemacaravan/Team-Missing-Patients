import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Patient = {
  id: string
  patient_identifier: string
  first_name: string
  last_name: string
  age: number
  date_of_birth?: string
  sex?: string
  days_overdue: number
  urgency_label: 'Critical' | 'High' | 'Medium' | 'Low'
  urgency_score: number
  preferred_language: string
  outreach_status: string
  home_phone: string
  mobile_phone?: string
  email_address: string
  clinic_id?: string
  most_recent_visit_date?: string
  address_line_1?: string
  address_line_2?: string
  city?: string
  state?: string
  postal_code?: string
  active?: string
}

export type Encounter = {
  patient_record_number: string
  encounter_date: string
  care_category: string
  visit_type: string
  diagnosis: string
  icd_code?: string | null
  appointment_time?: string | null
  attended?: string | null
  notes?: string | null
  showed_up?: boolean | null
}

export async function fetchAllPatients(clinicId?: string | null): Promise<Patient[]> {
  const PAGE = 1000
  const all: Patient[] = []
  let from = 0
  while (true) {
    const base = supabase
      .from('patients')
      .select('*')
      .order('urgency_score', { ascending: false })
    const q = clinicId ? base.eq('clinic_id', clinicId) : base
    const { data, error } = await q.range(from, from + PAGE - 1)
    if (error || !data || data.length === 0) break
    all.push(...(data as Patient[]))
    if (data.length < PAGE) break
    from += PAGE
  }
  return all
}