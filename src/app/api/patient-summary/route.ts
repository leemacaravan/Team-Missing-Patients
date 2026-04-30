import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth'
import { serverSupabase } from '@/lib/server-supabase'
import { CLINIC_ID_TO_TYPE } from '@/config/clinicMap'

// ── In-memory rate limiter ────────────────────────────────────────────────────
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000

function checkAndIncrementRateLimit(clinicId: string): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(clinicId)
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(clinicId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count += 1
  return true
}

// ── Response validation — strip >500 chars, reject obvious PII ───────────────
function validateResponse(text: string): { safe: boolean; cleaned: string } {
  const truncated = text.slice(0, 500)
  if (/\b\d{3}[-.\s()]{0,2}\d{3}[-.\s]\d{4}\b/.test(truncated)) return { safe: false, cleaned: '' }
  if (/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/.test(truncated)) return { safe: false, cleaned: '' }
  if (/\b\d{3}-\d{2}-\d{4}\b/.test(truncated)) return { safe: false, cleaned: '' }
  return { safe: true, cleaned: truncated }
}

const SYSTEM_PROMPT = `You are a clinical decision support assistant for a community health clinic. You receive only anonymized, de-identified patient data — no names, no dates of birth, no contact information.

Generate a brief 3-4 sentence clinical summary for clinic staff that covers:
1. Urgency level and days overdue context
2. Brief care history from visit types and ICD codes (no patient names, just patterns)
3. Outreach recommendation based on urgency
4. Language note for outreach

Guidelines:
- Use plain language accessible to non-clinical staff
- Be concise — maximum 4 sentences
- Never make diagnostic conclusions
- Never recommend specific treatments
- Only summarize what is in the data provided
- Each response is completely independent — you have no memory of any previous patient`

export async function POST(request: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await verifySessionToken(token)
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 500 })

  const { patient_id, clinic_id } = await request.json()
  if (!patient_id || !clinic_id) {
    return NextResponse.json({ error: 'Missing patient_id or clinic_id' }, { status: 400 })
  }

  // ── Clinic isolation ──────────────────────────────────────────────────────
  if (user.clinicId && user.clinicId !== clinic_id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  // ── Rate limiting ─────────────────────────────────────────────────────────
  if (!checkAndIncrementRateLimit(clinic_id)) {
    return NextResponse.json({ error: 'Summary limit reached. Try again in an hour.' }, { status: 429 })
  }

  // ── Fetch patient (verify clinic ownership) ───────────────────────────────
  const { data: patient, error: patientError } = await serverSupabase
    .from('patients')
    .select('id, age, urgency_label, days_overdue, outreach_status, preferred_language, most_recent_visit_date, patient_identifier, clinic_id')
    .eq('id', patient_id)
    .eq('clinic_id', clinic_id)
    .single()

  if (patientError || !patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }

  // ── Fetch encounters (anonymized fields only) ─────────────────────────────
  const { data: encounters } = await serverSupabase
    .from('encounters')
    .select('visit_type, icd_code, care_category, encounter_date')
    .eq('patient_record_number', patient.patient_identifier)
    .order('encounter_date', { ascending: false })

  const encs = encounters ?? []
  const clinicType = CLINIC_ID_TO_TYPE[clinic_id] ?? 'general'

  // ── Build anonymized data — NO name, NO DOB, NO phone, NO email, NO address
  const visitTypes = [...new Set(encs.map((e) => e.visit_type).filter(Boolean))]
  const icdCodes = [...new Set(encs.map((e) => e.icd_code).filter(Boolean))]
  const careCategories = [...new Set(encs.map((e) => e.care_category).filter(Boolean))]

  const userContent = [
    'Anonymized patient data for clinical summary (no identifying information):',
    '',
    `Age: ${patient.age} years`,
    `Urgency level: ${patient.urgency_label}`,
    `Days overdue for care: ${patient.days_overdue}`,
    `Clinic type: ${clinicType}`,
    `Outreach status: ${patient.outreach_status === 'contacted' ? 'already contacted' : 'not yet contacted'}`,
    `Preferred language: ${patient.preferred_language || 'English'}`,
    `Total encounters on record: ${encs.length}`,
    `Visit types seen: ${visitTypes.length > 0 ? visitTypes.join(', ') : 'none recorded'}`,
    `ICD codes on record: ${icdCodes.length > 0 ? icdCodes.join(', ') : 'none recorded'}`,
    `Care categories: ${careCategories.length > 0 ? careCategories.join(', ') : 'none recorded'}`,
    `Most recent visit: ${patient.most_recent_visit_date ?? 'not recorded'}`,
    '',
    'Generate a brief 3-4 sentence clinical summary for clinic staff.',
  ].join('\n')

  // ── Call Claude API ───────────────────────────────────────────────────────
  let aiRes: Response
  try {
    aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
    })
  } catch {
    // Log only: clinic_id, timestamp, failure — no patient data
    console.error('[patient-summary] network error', { clinic_id, ts: new Date().toISOString(), success: false })
    return NextResponse.json({ error: 'AI service unavailable' }, { status: 502 })
  }

  if (!aiRes.ok) {
    console.error('[patient-summary] AI error', { clinic_id, ts: new Date().toISOString(), status: aiRes.status, success: false })
    return NextResponse.json({ error: 'AI request failed' }, { status: 502 })
  }

  const aiData = await aiRes.json()
  const rawText: string = aiData.content?.[0]?.text ?? ''

  // ── Validate response ─────────────────────────────────────────────────────
  const { safe, cleaned } = validateResponse(rawText)
  if (!safe || !cleaned.trim()) {
    console.error('[patient-summary] response failed validation', { clinic_id, ts: new Date().toISOString(), success: false })
    return NextResponse.json({
      summary: 'Unable to generate summary at this time. Please review patient data manually.',
    })
  }

  // Log: clinic_id, timestamp, success — no patient data
  console.info('[patient-summary]', { clinic_id, ts: new Date().toISOString(), success: true })

  return NextResponse.json({ summary: cleaned.trim() })
}
