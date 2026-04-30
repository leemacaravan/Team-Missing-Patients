// Connection test — reads .env.local, queries Supabase, reports count
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dir, '..', '.env.local')
const env = {}
try {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].trim()
  }
} catch {
  console.error('Could not read .env.local')
  process.exit(1)
}

const url = env['NEXT_PUBLIC_SUPABASE_URL']
const key = env['SUPABASE_SERVICE_ROLE_KEY'] ?? env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
const keyType = env['SUPABASE_SERVICE_ROLE_KEY'] ? 'service_role' : 'anon'

if (!url || !key) {
  console.error('Missing SUPABASE URL or KEY in .env.local')
  process.exit(1)
}

console.log(`Using key type: ${keyType}`)
console.log(`Supabase URL: ${url}`)
console.log()

const res = await fetch(
  `${url}/rest/v1/patients?select=count&clinic_id=eq.clinic_pediatrics`,
  {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'count=exact',
    },
  }
)

if (!res.ok) {
  console.error(`Query failed: ${res.status} ${res.statusText}`)
  const body = await res.text()
  console.error(body)
  process.exit(1)
}

const count = res.headers.get('content-range')
const body = await res.json()
console.log(`Connection: OK`)
console.log(`Patients with clinic_id = 'clinic_pediatrics': ${count ?? JSON.stringify(body)}`)

// Also check service role key presence
const hasServiceKey = !!env['SUPABASE_SERVICE_ROLE_KEY']
console.log()
console.log(`SUPABASE_SERVICE_ROLE_KEY in .env.local: ${hasServiceKey ? 'YES' : 'NO ⚠️'}`)
if (!hasServiceKey) {
  console.log('  → Seed script requires service role key to bypass RLS.')
  console.log('  → Add it to .env.local before running seedPediatrics.ts')
}
