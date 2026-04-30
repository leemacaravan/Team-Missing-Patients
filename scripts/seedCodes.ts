import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dir, '..', '.env.local')
const env: Record<string, string> = {}
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}

const url = env['NEXT_PUBLIC_SUPABASE_URL']
const serviceKey = env['SUPABASE_SERVICE_ROLE_KEY']
const anonKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? env['SUPABASE_ANON_KEY']
const accessToken = env['SUPABASE_ACCESS_TOKEN']
const key = serviceKey || anonKey

if (!url || !key) {
  console.error('Missing SUPABASE URL or KEY in .env.local')
  process.exit(1)
}

// Extract project ref from URL: https://<ref>.supabase.co
const projectRef = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

const supabase = createClient(url, key)

const CODES: Array<{ code: string; description: string }> = [
  // Pediatrics — Well Visit
  { code: 'Z38.00',  description: 'Newborn (Liveborn Infant)' },
  { code: 'Z00.110', description: 'Newborn Exam (under 8 days)' },
  { code: 'Z00.111', description: 'Newborn Exam (8–28 days)' },
  { code: 'Z00.121', description: 'Routine Child Exam (with abnormal findings)' },
  { code: 'Z00.129', description: 'Routine Child Exam (no abnormal findings)' },
  // Pediatrics — Immunization
  { code: 'Z23',     description: 'Immunization Visit' },
  // Pediatrics — Screening
  { code: 'Z13.4',   description: 'Developmental Screening' },
  { code: 'Z13.5',   description: 'Vision Screening' },
  { code: 'Z13.89',  description: 'Behavioral/Other Screening' },
  // Pediatrics — Sick Visit
  { code: 'J06.9',   description: 'Upper Respiratory Infection' },
  { code: 'H66.90',  description: 'Ear Infection (Otitis Media)' },
  { code: 'J02.9',   description: 'Sore Throat' },
  { code: 'R50.9',   description: 'Fever' },
  { code: 'K52.9',   description: 'Gastroenteritis' },
  { code: 'P59.9',   description: 'Neonatal Jaundice' },
  // Pediatrics — Follow-up / Chronic
  { code: 'J45.909', description: 'Asthma' },
  { code: 'F90.9',   description: 'ADHD' },
  { code: 'L20.9',   description: 'Eczema' },
  { code: 'P07.30',  description: 'Preterm Birth' },
  // Pediatrics — Sports Physical
  { code: 'Z02.5',   description: 'Pre-participation Sports Physical' },
  // Family Medicine — Well Visit
  { code: 'Z00.00',  description: 'Annual Wellness Exam' },
  // Family Medicine — Follow-up / Chronic
  { code: 'I10',     description: 'Hypertension' },
  { code: 'E11.9',   description: 'Type 2 Diabetes' },
  { code: 'M54.5',   description: 'Back Pain' },
  { code: 'J30.9',   description: 'Allergic Rhinitis' },
  // Family Medicine — Prenatal
  { code: 'Z34.12',  description: 'Prenatal Care' },
  // Behavioral Health — Mental Health
  { code: 'F32.9',   description: 'Major Depression' },
  { code: 'F41.1',   description: 'Generalized Anxiety' },
  { code: 'F43.10',  description: 'PTSD' },
  { code: 'F20.9',   description: 'Schizophrenia' },
  { code: 'F31.9',   description: 'Bipolar Disorder' },
  { code: 'R45.851', description: 'Suicidal Ideation' },
  { code: 'F10.20',  description: 'Alcohol Use Disorder' },
]

async function createTableViaMgmtApi() {
  if (!accessToken || !projectRef) return false

  const sql = `
    create table if not exists public.codes (
      id uuid primary key default gen_random_uuid(),
      code text not null unique,
      description text not null
    );
    alter table public.encounters
      add column if not exists diagnosis_code_id uuid references public.codes(id),
      add column if not exists notes text,
      add column if not exists showed_up boolean default false;
    create index if not exists encounters_diagnosis_code_id_idx on public.encounters(diagnosis_code_id);
  `

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  )

  if (!res.ok) {
    const body = await res.text()
    console.error(`Management API error ${res.status}: ${body}`)
    return false
  }

  console.log('Table created (or already exists) via Management API.')
  return true
}

async function main() {
  // Step 1: ensure the codes table exists
  if (accessToken && projectRef) {
    console.log(`Creating codes table via Supabase Management API (project: ${projectRef})...`)
    const ok = await createTableViaMgmtApi()
    if (!ok) {
      console.error('Failed to create table. Aborting.')
      process.exit(1)
    }
  } else {
    console.error(`
ERROR: Cannot create the codes table — DDL requires the Supabase Management API.

Add the following line to your .env.local:
  SUPABASE_ACCESS_TOKEN=<your-personal-access-token>

Get your PAT at: https://supabase.com/dashboard/account/tokens
Then re-run: npx tsx scripts/seedCodes.ts
`)
    process.exit(1)
  }

  // Step 2: upsert codes
  console.log(`Seeding ${CODES.length} diagnosis codes...`)
  const { error } = await supabase
    .from('codes')
    .upsert(CODES, { onConflict: 'code' })

  if (error) {
    console.error('Failed to seed codes:', error.message)
    process.exit(1)
  }

  const { count, error: countErr } = await supabase
    .from('codes')
    .select('*', { count: 'exact', head: true })

  if (countErr) {
    console.warn('Could not verify count:', countErr.message)
  } else {
    console.log(`${count} codes inserted/updated successfully`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
