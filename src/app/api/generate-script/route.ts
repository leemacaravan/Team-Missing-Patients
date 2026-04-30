import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const { first_name, last_name, days_overdue, preferred_language, clinic_type, ai_instructions } =
    await request.json()

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'API key not configured' }, { status: 500 })
  }

  const lang = preferred_language?.trim() || 'English'

  const languageInstruction = `CRITICAL: Write the ENTIRE script in ${lang}. Do not write in English if the language is not English. Do not mix languages. The greeting, body, and closing must ALL be in ${lang}.`

  const isPediatric = clinic_type === 'pediatrics'
  const isBehavioral = clinic_type === 'behavioral_health'

  const customInstructions = ai_instructions
    ? `\n\nAdditional instructions: ${ai_instructions}`
    : ''

  const prompt = isPediatric
    ? `You are a pediatric care coordinator drafting a warm, professional phone outreach script to a parent or guardian.

${languageInstruction}

Child patient: ${first_name} ${last_name}
Days overdue for well-child visit: ${days_overdue}

Write a concise phone script (under 200 words) for a care coordinator to read when calling the child's parent or guardian. The tone should be warm, reassuring, and family-centered. Include:
1. A greeting and introduction (address the parent/guardian, not the child)
2. The reason for the call (child is overdue for a well-child visit)
3. An offer to schedule a well-child appointment
4. A closing with contact information placeholder [CLINIC PHONE]
${customInstructions}
Do not include any patient health details beyond what is provided. Output only the script text, no headings or meta-commentary.`
    : isBehavioral
    ? `You are a behavioral health care coordinator drafting a warm, professional phone outreach script.

${languageInstruction}

Patient: ${first_name} ${last_name}
Days since last session: ${days_overdue}

Write a concise phone script (under 200 words) for a care coordinator to read when calling this patient. The tone should be calm, non-judgmental, and supportive. Include:
1. A warm greeting and introduction
2. The reason for the call (it has been a while since their last session)
3. An offer to reconnect and schedule a session
4. A closing with contact information placeholder [CLINIC PHONE]
${customInstructions}
Do not mention specific diagnoses or conditions. Output only the script text, no headings or meta-commentary.`
    : `You are a clinical care coordinator drafting a warm, professional phone outreach script.

${languageInstruction}

Patient: ${first_name} ${last_name}
Days overdue for care: ${days_overdue}

Write a concise phone script (under 200 words) for a care coordinator to read when calling this patient. The tone should be warm, non-alarming, and patient-centered. Include:
1. A greeting and introduction
2. The reason for the call (overdue for a care visit)
3. An offer to schedule an appointment
4. A closing with contact information placeholder [CLINIC PHONE]
${customInstructions}
Do not include any patient health details beyond what is provided. Output only the script text, no headings or meta-commentary.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return Response.json({ error: err }, { status: res.status })
  }

  const data = await res.json()
  const script = data.content?.[0]?.text ?? ''

  return Response.json({ script })
}
