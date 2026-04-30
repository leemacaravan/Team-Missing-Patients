'use client'

import { useState } from 'react'
import Link from 'next/link'

const EHR_OPTIONS = [
  'Practice Fusion',
  'eClinicalWorks',
  'Epic',
  'Athena Health',
  'Cerner',
  'NextGen',
  'Other',
]

const CLINIC_TYPES = [
  'Pediatrics',
  'Family Medicine',
  'Behavioral Health',
  'Internal Medicine',
  'FQHC / Community Health',
  'Other',
]

export default function RequestAccessPage() {
  const [form, setForm] = useState({
    clinic_name: '',
    clinic_type: '',
    admin_name: '',
    email: '',
    phone: '',
    ehr_system: '',
    message: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/access-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error ?? 'Submission failed. Please try again.')
      return
    }
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#f0f9ff] p-4">
        <div className="w-full max-w-md rounded-[6px] border border-[#e2e8f0] bg-white p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-[#F0FBF7] flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
              <path d="M5 13l4 4L19 7" stroke="#028090" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="text-[18px] font-semibold text-[#111] mb-2">Request received</h2>
          <p className="text-[13px] text-[#6B7280] leading-relaxed mb-6">
            Thanks for your interest in Missing Patients. Our team will review your request and reach out to{' '}
            <span className="font-medium text-[#374151]">{form.email}</span> within a few business days.
          </p>
          <Link
            href="/login"
            className="inline-block text-[13px] font-medium text-[#028090] hover:underline"
          >
            ← Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#f0f9ff] overflow-y-auto">
      <div className="min-h-full flex flex-col items-center justify-start p-4 py-10">
        <div className="w-full max-w-lg flex flex-col gap-5">
          {/* Header */}
          <div>
            <Link href="/login" className="inline-flex items-center gap-1.5 text-[12px] text-[#6B7280] hover:text-[#374151] mb-4 transition-colors">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back to sign in
            </Link>
            <h1 className="text-[22px] font-semibold text-[#111] tracking-tight">Request access</h1>
            <p className="text-[13px] text-[#6B7280] mt-1 leading-snug">
              Missing Patients is currently in evaluation. Tell us about your clinic and we'll be in touch.
            </p>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {/* Clinic information */}
            <div className="rounded-[6px] border border-[#e2e8f0] bg-white p-5">
              <h2 className="text-[12px] font-semibold text-[#374151] uppercase tracking-[.06em] mb-4">Clinic Information</h2>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[#374151] mb-1">
                    Clinic name <span className="text-[#B91C1C]">*</span>
                  </label>
                  <input
                    value={form.clinic_name}
                    onChange={(e) => set('clinic_name', e.target.value)}
                    placeholder="Riverside Community Health"
                    required
                    className="w-full rounded-[4px] border border-[#E5E7EB] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#374151] mb-1">Clinic type</label>
                  <select
                    value={form.clinic_type}
                    onChange={(e) => set('clinic_type', e.target.value)}
                    className="w-full rounded-[4px] border border-[#E5E7EB] px-3 py-2.5 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090] transition-colors"
                  >
                    <option value="">Select type…</option>
                    {CLINIC_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Admin contact */}
            <div className="rounded-[6px] border border-[#e2e8f0] bg-white p-5">
              <h2 className="text-[12px] font-semibold text-[#374151] uppercase tracking-[.06em] mb-4">Admin Contact</h2>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[#374151] mb-1">Your name</label>
                  <input
                    value={form.admin_name}
                    onChange={(e) => set('admin_name', e.target.value)}
                    placeholder="Dr. Jane Smith"
                    className="w-full rounded-[4px] border border-[#E5E7EB] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#374151] mb-1">
                    Email <span className="text-[#B91C1C]">*</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    placeholder="you@clinic.org"
                    required
                    autoComplete="email"
                    className="w-full rounded-[4px] border border-[#E5E7EB] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#374151] mb-1">Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    placeholder="(555) 000-0000"
                    autoComplete="tel"
                    className="w-full rounded-[4px] border border-[#E5E7EB] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090] transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Current setup */}
            <div className="rounded-[6px] border border-[#e2e8f0] bg-white p-5">
              <h2 className="text-[12px] font-semibold text-[#374151] uppercase tracking-[.06em] mb-4">Current Setup</h2>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[#374151] mb-1">Current EHR system</label>
                  <select
                    value={form.ehr_system}
                    onChange={(e) => set('ehr_system', e.target.value)}
                    className="w-full rounded-[4px] border border-[#E5E7EB] px-3 py-2.5 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090] transition-colors"
                  >
                    <option value="">Select EHR…</option>
                    {EHR_OPTIONS.map((e) => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#374151] mb-1">Anything else we should know?</label>
                  <textarea
                    value={form.message}
                    onChange={(e) => set('message', e.target.value)}
                    rows={3}
                    placeholder="Number of patients, specific outreach challenges, timeline…"
                    className="w-full rounded-[4px] border border-[#E5E7EB] px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090] transition-colors"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-[4px] bg-[#FEF2F2] border border-[#FECACA] px-4 py-3 text-[13px] text-[#B91C1C]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-[4px] bg-[#028090] px-4 py-3 text-sm font-medium text-white hover:bg-[#025f6b] disabled:opacity-60 transition-colors"
            >
              {loading ? 'Submitting…' : 'Submit request →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
