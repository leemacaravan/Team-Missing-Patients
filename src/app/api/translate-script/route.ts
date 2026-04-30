import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const { script } = await request.json()

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'API key not configured' }, { status: 500 })
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `Translate the following phone script to English, keeping the same warm clinical tone. Output only the translated script text, no headings or meta-commentary.\n\n${script}`,
        },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return Response.json({ error: err }, { status: res.status })
  }

  const data = await res.json()
  const translation = data.content?.[0]?.text ?? ''

  return Response.json({ translation })
}
