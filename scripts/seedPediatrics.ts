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
const key = serviceKey || anonKey

if (!url || !key) {
  console.error('Missing SUPABASE URL or KEY in .env.local')
  process.exit(1)
}
if (!serviceKey) {
  console.warn('WARNING: SUPABASE_SERVICE_ROLE_KEY not found — using anon key, RLS may block deletes/inserts')
}

const supabase = createClient(url, key)

// ── helpers ──────────────────────────────────────────────────────────────────

function rng(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function phoneNumber(): string {
  return `(${rng(200, 999)}) ${rng(200, 999)}-${String(rng(1000, 9999))}`
}

function emailFor(first: string, last: string, idx: number): string {
  return `${first.toLowerCase()}.${last.toLowerCase()}${idx}@example.com`
}

// days_overdue = today − most_recent_visit_date
// urgency derived from ratio of days_overdue to the age-group interval
function computeUrgency(daysOverdue: number, interval: number): { label: string; score: number } {
  const ratio = daysOverdue / interval
  if (ratio >= 3) return { label: 'Critical', score: 4 }
  if (ratio >= 2) return { label: 'High',     score: 3 }
  if (ratio >= 1) return { label: 'Medium',   score: 2 }
  return               { label: 'Low',       score: 1 }
}

// For non-newborn groups: desired urgency → target days since last visit.
// The caller caps this at ageDays before using it.
function targetDaysOverdue(desired: string, interval: number): number {
  switch (desired) {
    case 'Critical': return Math.round(interval * (3 + Math.random()))          // 3–4×
    case 'High':     return Math.round(interval * (2 + Math.random()))          // 2–3×
    case 'Medium':   return Math.round(interval * (1 + Math.random()))          // 1–2×
    default:         return Math.round(interval * (0.1 + Math.random() * 0.9)) // 0.1–1× (Low)
  }
}

// Weighted distribution: ~30% Critical, ~25% High, ~25% Medium, ~20% Low
function pickDesiredUrgency(): string {
  const r = Math.random()
  if (r < 0.30) return 'Critical'
  if (r < 0.55) return 'High'
  if (r < 0.80) return 'Medium'
  return 'Low'
}

// ── name banks ───────────────────────────────────────────────────────────────

const FIRST_NAMES_M = [
  'Liam','Noah','Oliver','Elijah','James','Aiden','Lucas','Mason','Ethan','Logan',
  'Jackson','Sebastian','Mateo','Jack','Owen','Theodore','Henry','Leo','Muhammad',
  'Jayden','Isaiah','Asher','Benjamin','Julian','Nathan','Christian','Daniel','Caleb','Ryan',
]
const FIRST_NAMES_F = [
  'Emma','Olivia','Ava','Isabella','Sophia','Charlotte','Mia','Amelia','Harper','Evelyn',
  'Abigail','Emily','Ella','Elizabeth','Camila','Luna','Sofia','Avery','Mila','Aria',
  'Scarlett','Penelope','Layla','Chloe','Victoria','Madison','Eleanor','Grace','Nora','Riley',
]
const LAST_NAMES = [
  'Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez',
  'Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin',
  'Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson',
  'Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores',
  'Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts',
]

function preferredLanguage(): string {
  const r = Math.random()
  if (r < 0.70) return 'English'
  if (r < 0.85) return 'Spanish'
  if (r < 0.95) return 'Mandarin'
  return pick(['French', 'Arabic', 'Haitian Creole', 'Portuguese'])
}

// ── age group definitions ─────────────────────────────────────────────────────

type AgeGroup = {
  label: string
  count: number
  minAgeDays: number
  maxAgeDays: number
  intervalDays: number  // recommended visit interval in days
}

const AGE_GROUPS: AgeGroup[] = [
  { label: 'newborn',         count: 20, minAgeDays: 0,    maxAgeDays: 89,   intervalDays: 30  },
  { label: 'infant',          count: 20, minAgeDays: 90,   maxAgeDays: 364,  intervalDays: 60  },
  { label: 'toddler',         count: 25, minAgeDays: 365,  maxAgeDays: 1094, intervalDays: 90  },
  { label: 'early_childhood', count: 25, minAgeDays: 1095, maxAgeDays: 1824, intervalDays: 180 },
  { label: 'school_age',      count: 30, minAgeDays: 1825, maxAgeDays: 4014, intervalDays: 365 },
  { label: 'teen',            count: 30, minAgeDays: 4015, maxAgeDays: 6204, intervalDays: 365 },
]

// ── encounter templates by age group ─────────────────────────────────────────

type EncounterTemplate = {
  icd_code: string
  care_category: string
  visit_type: string
  diagnosis: string
  offsetDays: number  // days before today; must be in [0, ageDays]
}

function encountersForGroup(
  group: string,
  ageDays: number,
): EncounterTemplate[] {
  const enc: EncounterTemplate[] = []

  if (group === 'newborn') {
    // Birth / hospital encounter
    enc.push({
      icd_code: 'Z38.00',
      care_category: 'Well Visit',
      visit_type: 'Well Child',
      diagnosis: 'Newborn (Liveborn Infant)',
      offsetDays: ageDays,
    })
    if (ageDays >= 7) {
      enc.push({
        icd_code: 'Z00.110',
        care_category: 'Well Visit',
        visit_type: 'Well Child',
        diagnosis: 'Newborn Exam (under 8 days)',
        offsetDays: ageDays - 7,
      })
    }
    if (ageDays >= 14) {
      enc.push({
        icd_code: 'Z23',
        care_category: 'Immunization',
        visit_type: 'Immunization Visit',
        diagnosis: 'Immunization Visit',
        offsetDays: ageDays - 14,
      })
    }

  } else if (group === 'infant') {
    // Well-child visits at roughly 3, 4, 6, 9-month marks
    const milestones = [ageDays - 30, ageDays - 60, ageDays - 120, ageDays - 180]
    milestones
      .filter(d => d >= 0)
      .slice(0, 3)
      .forEach(offset => enc.push({
        icd_code: 'Z00.129',
        care_category: 'Well Visit',
        visit_type: 'Well Child',
        diagnosis: 'Routine Child Exam (no abnormal findings)',
        offsetDays: offset,
      }))
    if (ageDays >= 60) {
      enc.push({
        icd_code: 'Z23',
        care_category: 'Immunization',
        visit_type: 'Immunization Visit',
        diagnosis: 'Immunization Visit',
        offsetDays: ageDays - 60,
      })
    }
    if (Math.random() < 0.4 && ageDays > 40) {
      enc.push({
        icd_code: pick(['J06.9', 'R50.9', 'H66.90']),
        care_category: 'Sick Visit',
        visit_type: 'Sick Visit',
        diagnosis: pick(['Upper Respiratory Infection', 'Fever', 'Ear Infection (Otitis Media)']),
        offsetDays: rng(10, ageDays - 10),
      })
    }

  } else if (group === 'toddler') {
    const visitOffsets = [ageDays - 180, ageDays - 270, ageDays - 365].filter(d => d >= 0)
    visitOffsets.forEach(offset => enc.push({
      icd_code: 'Z00.129',
      care_category: 'Well Visit',
      visit_type: 'Well Child',
      diagnosis: 'Routine Child Exam (no abnormal findings)',
      offsetDays: offset,
    }))
    if (ageDays >= 365) {
      enc.push({
        icd_code: 'Z23',
        care_category: 'Immunization',
        visit_type: 'Immunization Visit',
        diagnosis: 'Immunization Visit',
        offsetDays: ageDays - 365,
      })
      enc.push({
        icd_code: 'Z13.4',
        care_category: 'Screening',
        visit_type: 'Developmental Screening',
        diagnosis: 'Developmental Screening',
        offsetDays: ageDays - 270,
      })
    }
    if (Math.random() < 0.5 && ageDays > 60) {
      enc.push({
        icd_code: pick(['J06.9', 'R50.9', 'K52.9']),
        care_category: 'Sick Visit',
        visit_type: 'Sick Visit',
        diagnosis: pick(['Upper Respiratory Infection', 'Fever', 'Gastroenteritis']),
        offsetDays: rng(30, ageDays - 10),
      })
    }

  } else if (group === 'early_childhood') {
    const years = Math.floor(ageDays / 365)
    for (let y = 1; y <= Math.min(years, 3); y++) {
      enc.push({
        icd_code: 'Z00.129',
        care_category: 'Well Visit',
        visit_type: 'Well Child',
        diagnosis: 'Routine Child Exam (no abnormal findings)',
        offsetDays: ageDays - y * 365,
      })
    }
    enc.push({
      icd_code: 'Z13.4',
      care_category: 'Screening',
      visit_type: 'Developmental Screening',
      diagnosis: 'Developmental Screening',
      offsetDays: ageDays - 365,
    })
    enc.push({
      icd_code: 'Z23',
      care_category: 'Immunization',
      visit_type: 'Immunization Visit',
      diagnosis: 'Immunization Visit',
      offsetDays: ageDays - 365 * Math.min(years, 2),
    })

  } else if (group === 'school_age') {
    const years = Math.floor(ageDays / 365)
    for (let y = 1; y <= Math.min(years, 4); y++) {
      enc.push({
        icd_code: 'Z00.129',
        care_category: 'Well Visit',
        visit_type: 'Well Child',
        diagnosis: 'Routine Child Exam (no abnormal findings)',
        offsetDays: ageDays - y * 365,
      })
    }
    enc.push({
      icd_code: 'Z13.5',
      care_category: 'Screening',
      visit_type: 'Vision Screening',
      diagnosis: 'Vision Screening',
      offsetDays: ageDays - 365,
    })
    enc.push({
      icd_code: 'Z23',
      care_category: 'Immunization',
      visit_type: 'Immunization Visit',
      diagnosis: 'Immunization Visit',
      offsetDays: ageDays - 365 * 2,
    })
    if (Math.random() < 0.3) {
      enc.push({
        icd_code: pick(['J45.909', 'F90.9', 'L20.9']),
        care_category: 'Follow-up',
        visit_type: 'Follow-up Visit',
        diagnosis: pick(['Asthma', 'ADHD', 'Eczema']),
        offsetDays: rng(90, ageDays - 10),
      })
    }

  } else if (group === 'teen') {
    const years = Math.floor(ageDays / 365)
    for (let y = 1; y <= Math.min(years - 10, 5); y++) {
      enc.push({
        icd_code: 'Z00.129',
        care_category: 'Well Visit',
        visit_type: 'Well Child',
        diagnosis: 'Routine Child Exam (no abnormal findings)',
        offsetDays: ageDays - y * 365,
      })
    }
    enc.push({
      icd_code: 'Z13.89',
      care_category: 'Screening',
      visit_type: 'Behavioral Screening',
      diagnosis: 'Behavioral/Other Screening',
      offsetDays: ageDays - 365,
    })
    if (Math.random() < 0.4) {
      enc.push({
        icd_code: 'Z02.5',
        care_category: 'Sports Physical',
        visit_type: 'Sports Physical',
        diagnosis: 'Pre-participation Sports Physical',
        offsetDays: ageDays - rng(180, 540),
      })
    }
    if (Math.random() < 0.25) {
      enc.push({
        icd_code: pick(['F90.9', 'F32.9']),
        care_category: 'Mental Health',
        visit_type: 'Mental Health Visit',
        diagnosis: pick(['ADHD', 'Depression']),
        offsetDays: rng(90, ageDays - 10),
      })
    }
  }

  // Guard: no encounter before birth (offsetDays > ageDays) or in the future (offsetDays < 0)
  return enc.filter(e => e.offsetDays >= 0 && e.offsetDays <= ageDays)
}

// ── delete existing data ──────────────────────────────────────────────────────

async function deleteExistingData() {
  console.log('Deleting existing clinic_pediatrics data...')

  // Fetch existing identifiers so we can delete their encounters
  const { data: existing, error: fetchErr } = await supabase
    .from('patients')
    .select('patient_identifier')
    .eq('clinic_id', 'clinic_pediatrics')

  if (fetchErr) {
    console.error('Failed to fetch existing patients:', fetchErr.message)
    process.exit(1)
  }

  const identifiers = (existing ?? []).map(p => p.patient_identifier).filter(Boolean)
  console.log(`  Found ${identifiers.length} existing patients`)

  // Delete encounters in chunks (avoid query string length limits)
  if (identifiers.length > 0) {
    for (let i = 0; i < identifiers.length; i += 100) {
      const chunk = identifiers.slice(i, i + 100)
      const { error } = await supabase
        .from('encounters')
        .delete()
        .in('patient_record_number', chunk)
      if (error) console.warn('  Encounter delete warning:', error.message)
    }
    console.log('  Encounters deleted')
  }

  // Delete patients
  const { error: patDelErr } = await supabase
    .from('patients')
    .delete()
    .eq('clinic_id', 'clinic_pediatrics')
  if (patDelErr) {
    console.error('Patient delete failed:', patDelErr.message)
    process.exit(1)
  }
  console.log('  Patients deleted\n')
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  await deleteExistingData()

  console.log('Seeding 150 pediatric patients for clinic_pediatrics...\n')

  const today = new Date()
  const patients: Record<string, unknown>[] = []
  const encounters: Record<string, unknown>[] = []
  const seenDedup = new Set<string>()

  let idx = 1

  for (const group of AGE_GROUPS) {
    for (let i = 0; i < group.count; i++) {
      const sex = Math.random() < 0.5 ? 'M' : 'F'
      const firstName = pick(sex === 'M' ? FIRST_NAMES_M : FIRST_NAMES_F)
      const lastName = pick(LAST_NAMES)

      const ageDays = rng(group.minAgeDays, group.maxAgeDays)
      const dob = addDays(today, -ageDays)
      const ageYears = Math.floor(ageDays / 365)

      // ── core fix: days_overdue = today − most_recent_visit_date ──────────
      // most_recent_visit_date must be ≥ date_of_birth (never before birth)
      // so days_overdue cannot exceed ageDays.

      let daysOverdue: number

      if (group.label === 'newborn') {
        // Newborns are seen 1–3 days after birth (hospital / first well-baby check).
        // days_overdue = ageDays − days_since_birth_to_first_visit
        const firstVisitDayAfterBirth = Math.min(rng(1, 3), ageDays)
        daysOverdue = Math.max(0, ageDays - firstVisitDayAfterBirth)
        // A 0-day-old has daysOverdue = 0; a 27-day-old has daysOverdue ≤ 26.
      } else {
        // Non-newborns: pick desired urgency tier → target days since last visit.
        // Cap at ageDays so most_recent_visit_date cannot precede date_of_birth.
        const desired = pickDesiredUrgency()
        const target  = targetDaysOverdue(desired, group.intervalDays)
        daysOverdue   = Math.min(ageDays, Math.max(1, target))
      }

      // Urgency is derived from the actual (possibly capped) days_overdue value.
      const urgency = computeUrgency(daysOverdue, group.intervalDays)
      const mostRecentVisitDate = addDays(today, -daysOverdue)

      const patientIdentifier = `PED-${String(idx).padStart(4, '0')}`
      const patientId = crypto.randomUUID()

      patients.push({
        id: patientId,
        patient_identifier: patientIdentifier,
        first_name: firstName,
        last_name: lastName,
        date_of_birth: fmtDate(dob),
        age: ageYears,
        sex,
        home_phone: phoneNumber(),
        email_address: emailFor(firstName, lastName, idx),
        preferred_language: preferredLanguage(),
        active: 'Yes',
        clinic_id: 'clinic_pediatrics',
        outreach_status: 'pending',
        most_recent_visit_date: fmtDate(mostRecentVisitDate),
        days_overdue: daysOverdue,
        urgency_label: urgency.label,
        urgency_score: urgency.score,
      })

      const encTemplates = encountersForGroup(group.label, ageDays)
      for (const tmpl of encTemplates) {
        const encDate = fmtDate(addDays(today, -tmpl.offsetDays))
        const dedupKey = `${patientIdentifier}|${encDate}|${tmpl.icd_code}`
        if (seenDedup.has(dedupKey)) continue
        seenDedup.add(dedupKey)
        encounters.push({
          patient_record_number: patientIdentifier,
          encounter_date: encDate,
          care_category: tmpl.care_category,
          visit_type: tmpl.visit_type,
          diagnosis: tmpl.icd_code,
        })
      }

      idx++
    }
    console.log(`  ${group.label}: ${group.count} patients queued`)
  }

  console.log(`\nTotal patients: ${patients.length}`)
  console.log(`Total encounters: ${encounters.length}`)

  // Insert patients in batches of 50
  console.log('\nInserting patients...')
  for (let i = 0; i < patients.length; i += 50) {
    const batch = patients.slice(i, i + 50)
    const { error } = await supabase.from('patients').insert(batch)
    if (error) {
      console.error(`Patient batch ${Math.floor(i / 50) + 1} failed:`, error.message)
      process.exit(1)
    }
    console.log(`  Inserted patients ${i + 1}–${i + batch.length}`)
  }

  // Insert encounters in batches of 100
  console.log('\nInserting encounters...')
  for (let i = 0; i < encounters.length; i += 100) {
    const batch = encounters.slice(i, i + 100)
    const { error } = await supabase.from('encounters').insert(batch)
    if (error) {
      console.error('Encounter batch failed:', error.message)
      console.warn('  Skipping this batch and continuing...')
    } else {
      console.log(`  Inserted encounters ${i + 1}–${i + batch.length}`)
    }
  }

  // ── verification ─────────────────────────────────────────────────────────
  console.log('\nVerifying data integrity...')

  const { data: rows } = await supabase
    .from('patients')
    .select('age, days_overdue, urgency_label, date_of_birth')
    .eq('clinic_id', 'clinic_pediatrics')
    .order('days_overdue', { ascending: false })

  if (rows) {
    const { count } = await supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', 'clinic_pediatrics')
    console.log(`  Total patients in DB: ${count}`)

    // Constraint: days_overdue must not exceed age in days
    const violations = rows.filter(p => {
      const ageDays = Math.round((Date.now() - new Date(p.date_of_birth).getTime()) / 86_400_000)
      return p.days_overdue > ageDays
    })
    if (violations.length > 0) {
      console.error(`  ✗ CONSTRAINT VIOLATIONS: ${violations.length} patients have days_overdue > age_in_days`)
      violations.slice(0, 5).forEach(p => {
        const ageDays = Math.round((Date.now() - new Date(p.date_of_birth).getTime()) / 86_400_000)
        console.error(`    age=${p.age}y (${ageDays}d), days_overdue=${p.days_overdue}`)
      })
    } else {
      console.log('  ✓ No violations: all days_overdue ≤ age_in_days')
    }

    // Newborn summary
    const newborns = rows.filter(p => p.age === 0)
    if (newborns.length > 0) {
      const maxOD = Math.max(...newborns.map(p => p.days_overdue))
      const urgDist = newborns.reduce<Record<string, number>>((acc, p) => {
        acc[p.urgency_label] = (acc[p.urgency_label] ?? 0) + 1
        return acc
      }, {})
      console.log(`  Newborns (age=0): max days_overdue=${maxOD}, urgency breakdown=${JSON.stringify(urgDist)}`)
    }

    // Top 5 most overdue
    console.log('  Top 5 most overdue:')
    rows.slice(0, 5).forEach(p => {
      const ageDays = Math.round((Date.now() - new Date(p.date_of_birth).getTime()) / 86_400_000)
      console.log(`    age=${p.age}y (${ageDays}d old), days_overdue=${p.days_overdue}, urgency=${p.urgency_label}`)
    })
  }

  console.log('\nDone.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
