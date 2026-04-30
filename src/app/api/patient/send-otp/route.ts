import { NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import { serverSupabase } from '@/lib/server-supabase'

// Strip all non-digit chars; drop leading country code "1" for 11-digit numbers
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits[0] === '1') return digits.slice(1)
  return digits
}

function toE164(normalized10: string): string {
  return `+1${normalized10}`
}

// Find a patient whose home_phone or mobile_phone normalizes to `normalized`
// Phones are stored as "(NXX) NXX-XXXX". We filter by last 4 digits first
// to keep the candidate set small, then do exact match in JS.
async function findPatientByPhone(normalized: string) {
  const last4 = normalized.slice(-4)
  const { data } = await serverSupabase
    .from('patients')
    .select('id, first_name, last_name, patient_identifier, email_address, clinic_id, home_phone, mobile_phone')
    .or(`home_phone.ilike.%${last4}%,mobile_phone.ilike.%${last4}%`)
    .limit(50)

  return (
    data?.find((p) => {
      const hp = (p.home_phone ?? '').replace(/\D/g, '')
      const mp = (p.mobile_phone ?? '').replace(/\D/g, '')
      return hp === normalized || mp === normalized
    }) ?? null
  )
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const rawPhone = String(body.phone ?? '').trim()

  if (!rawPhone) {
    return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
  }

  const normalized = normalizePhone(rawPhone)
  if (normalized.length !== 10) {
    return NextResponse.json({ error: 'Please enter a valid 10-digit US phone number' }, { status: 400 })
  }

  // Cleanup expired codes older than 24 hours
  await serverSupabase
    .from('otp_codes')
    .delete()
    .lt('expires_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  // Rate limit: max 3 OTP requests per phone per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await serverSupabase
    .from('otp_codes')
    .select('*', { count: 'exact', head: true })
    .eq('phone', normalized)
    .gte('created_at', oneHourAgo)

  // Silent rate limit — never reveal whether the number exists
  if ((count ?? 0) >= 3) {
    return NextResponse.json({ ok: true })
  }

  const patient = await findPatientByPhone(normalized)

  // Generate OTP regardless to prevent timing side-channel
  const code = randomInt(100000, 999999).toString()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  if (patient) {
    await serverSupabase.from('otp_codes').insert({
      phone: normalized,
      code,
      expires_at: expiresAt,
    })

    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER

    if (accountSid && authToken && twilioPhone) {
      try {
        const twilio = (await import('twilio')).default
        const client = twilio(accountSid, authToken)
        await client.messages.create({
          body: `Your Missing Patients verification code is: ${code}. Valid for 10 minutes.`,
          from: twilioPhone,
          to: toE164(normalized),
        })
      } catch (err) {
        console.error('[Twilio] SMS failed:', err)
        // OTP is still stored; don't fail the request
      }
    } else {
      // Dev fallback — log code to console when Twilio is not configured
      console.log(`[DEV OTP] ${normalized} → ${code}`)
    }
  }

  // Always return the same response (never confirm whether number exists)
  return NextResponse.json({ ok: true })
}
