'use client'

import { useState } from 'react'
import Link from 'next/link'

const EHR_OPTIONS = ['Practice Fusion', 'eClinicalWorks', 'Epic', 'Athena Health', 'Cerner', 'NextGen', 'Other']
const CLINIC_TYPES = ['Pediatrics', 'Family Medicine', 'Behavioral Health', 'Internal Medicine', 'FQHC / Community Health', 'Other']

const CLINIC_ICONS = {
  Pediatrics: (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="7" r="3" stroke="#028090" strokeWidth="1.5" />
      <path d="M5 20c0-3.31 2.69-6 6-6s6 2.69 6 6" stroke="#028090" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 14.5 7 19M14 14.5l1 4.5" stroke="#028090" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  'Family Medicine': (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="9.5" y="3" width="3" height="16" rx="1.5" fill="#028090" opacity=".9" />
      <rect x="3" y="9.5" width="16" height="3" rx="1.5" fill="#028090" opacity=".9" />
    </svg>
  ),
  'Behavioral Health': (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="7.5" cy="11" r="4" stroke="#028090" strokeWidth="1.5" />
      <circle cx="14.5" cy="11" r="4" stroke="#028090" strokeWidth="1.5" />
      <path d="M11 7.5v7" stroke="#028090" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
}

type FormData = {
  clinic_name: string
  clinic_type: string
  admin_name: string
  email: string
  phone: string
  ehr_system: string
  message: string
}

export default function LandingPage() {
  const [formData, setFormData] = useState<FormData>({
    clinic_name: '',
    clinic_type: '',
    admin_name: '',
    email: '',
    phone: '',
    ehr_system: '',
    message: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')

  function scrollToForm() {
    document.getElementById('request-access')?.scrollIntoView({ behavior: 'smooth' })
  }

  function set(field: keyof FormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/access-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!res.ok) throw new Error('Request failed')
      setSubmitted(true)
    } catch {
      setSubmitError('Something went wrong. Please try again or email us directly.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ fontFamily: 'var(--font-geist-sans, system-ui, sans-serif)' }}
    >
      {/* Nav */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 h-14"
        style={{
          background: 'rgba(10,10,10,0.88)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-[4px] flex items-center justify-center shrink-0"
            style={{ background: '#028090' }}
          >
            <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
              <circle cx="7.5" cy="5.5" r="3.2" stroke="white" strokeWidth="1.6" />
              <path d="M2 15c0-3.04 2.46-5.5 5.5-5.5S13 11.96 13 15" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <span className="text-[15px] font-semibold text-white tracking-tight">Missing Patients</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={scrollToForm}
            className="text-[13px] font-medium px-4 py-1.5 rounded-[4px] transition-colors"
            style={{ background: 'rgba(2,128,144,0.15)', color: '#48cae4', border: '1px solid rgba(2,128,144,0.25)' }}
          >
            Request Access
          </button>
          <Link
            href="/login"
            className="text-[13px] font-medium px-4 py-1.5 rounded-[4px] transition-colors"
            style={{ color: '#8BA4C4', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            Sign In
          </Link>
        </div>
      </nav>

      {/* Hero — max 60vh so content below is visible */}
      <section
        className="relative flex flex-col items-center justify-center text-center px-6 pt-32 pb-16 min-h-[60vh]"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(2,128,144,0.18) 0%, transparent 70%), #0A0A0A',
        }}
      >
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-medium mb-8 tracking-wide uppercase"
          style={{
            background: 'rgba(2,128,144,0.12)',
            border: '1px solid rgba(2,128,144,0.25)',
            color: '#48cae4',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#48cae4' }} />
          Built at the Lally AI Academy 2026
        </div>

        <h1
          className="text-[clamp(2.625rem,5.5vw+1rem,4.5rem)] font-bold tracking-[-0.03em] leading-[1.05] max-w-3xl mb-6"
          style={{ color: '#F5F9F7' }}
        >
          Stop Losing Patients
          <br />
          <span style={{ color: '#028090' }}>to the Gaps</span>
        </h1>

        <p
          className="text-[clamp(1rem,1vw+0.75rem,1.125rem)] leading-relaxed max-w-xl mb-10"
          style={{ color: '#7D99B8' }}
        >
          Missing Patients helps community health clinics identify and re-engage patients overdue for
          care — powered by AI outreach in any language.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 mb-14">
          <button
            onClick={scrollToForm}
            className="flex items-center gap-2 px-6 py-3 rounded-[6px] text-[14px] font-semibold transition-all"
            style={{ background: '#028090', color: 'white' }}
          >
            Request Access
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <Link
            href="/login"
            className="flex items-center gap-2 px-6 py-3 rounded-[6px] text-[14px] font-medium transition-colors"
            style={{ color: '#8BA4C4', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            Sign In
          </Link>
        </div>

        {/* Stats */}
        <div
          className="grid grid-cols-2 sm:grid-cols-4 rounded-[6px] overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}
        >
          <div className="px-6 py-5 text-center border-r border-b sm:border-b-0" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="text-[28px] font-bold tracking-tight font-mono" style={{ color: '#F5F9F7' }}>1,800+</div>
            <div className="text-[12px] mt-0.5" style={{ color: '#4A6580' }}>Synthetic patients</div>
          </div>
          <div className="px-6 py-5 text-center border-b sm:border-b-0 sm:border-r" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="text-[28px] font-bold tracking-tight font-mono" style={{ color: '#F5F9F7' }}>3</div>
            <div className="text-[12px] mt-0.5" style={{ color: '#4A6580' }}>Clinic types</div>
          </div>
          <div className="px-6 py-5 text-center border-r" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="text-[28px] font-bold tracking-tight font-mono" style={{ color: '#F5F9F7' }}>5+</div>
            <div className="text-[12px] mt-0.5" style={{ color: '#4A6580' }}>Languages</div>
          </div>
          <div className="px-6 py-5 text-center">
            <div className="text-[28px] font-bold tracking-tight font-mono" style={{ color: '#F5F9F7' }}>30</div>
            <div className="text-[12px] mt-0.5" style={{ color: '#4A6580' }}>day sprint</div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 animate-bounce">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M4 7l5 5 5-5" stroke="#48cae4" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity=".5" />
          </svg>
        </div>
      </section>

      {/* Dark-to-light gradient transition */}
      <div style={{ height: '80px', background: 'linear-gradient(to bottom, #0A0A0A, #F7F9FC)' }} />

      {/* Features */}
      <section className="px-6 py-20" style={{ background: '#F7F9FC' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div
              className="text-[11px] font-semibold uppercase tracking-[.1em] mb-3"
              style={{ color: '#028090' }}
            >
              How it works
            </div>
            <h2
              className="text-[clamp(2rem,3vw+0.5rem,2.375rem)] font-bold tracking-[-0.02em]"
              style={{ color: '#0C1018' }}
            >
              Designed for the clinical workflow
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <path d="M11 2L3 7v8l8 5 8-5V7L11 2z" stroke="#028090" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M11 2v13M3 7l8 5 8-5" stroke="#028090" strokeWidth="1.5" strokeLinejoin="round" />
                  </svg>
                ),
                title: 'Urgency-Based Prioritization',
                body: 'AI scores every overdue patient by clinical urgency — not just days missed, but days missed relative to their care schedule. Critical patients surface first.',
              },
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <path d="M11 2C6.58 2 3 5.58 3 10c0 1.56.46 3.02 1.25 4.25L3 20l5.75-1.25A8 8 0 1011 2z" stroke="#028090" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M8 10h6M8 13h4" stroke="#028090" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                ),
                title: 'Multilingual AI Outreach',
                body: 'Generate personalized phone scripts in Spanish, Arabic, Mandarin, French and more — automatically, in seconds. Meet patients where they are.',
              },
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <rect x="2" y="3" width="18" height="16" rx="2" stroke="#028090" strokeWidth="1.5" />
                    <path d="M2 8h18M7 3v5M15 3v5" stroke="#028090" strokeWidth="1.4" strokeLinecap="round" />
                    <path d="M6 13h4M6 16h6" stroke="#028090" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                ),
                title: 'Multi-Clinic Architecture',
                body: 'Built for clinic networks. Each clinic gets isolated data, custom urgency rules, and clinic-type-specific AI behavior — from pediatrics to behavioral health.',
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-[6px] p-6"
                style={{ background: 'white', border: '1px solid #e2e8f0' }}
              >
                <div
                  className="w-10 h-10 rounded-[6px] flex items-center justify-center mb-4"
                  style={{ background: 'rgba(2,128,144,0.08)' }}
                >
                  {f.icon}
                </div>
                <h3 className="text-[15px] font-semibold mb-2" style={{ color: '#0C1018' }}>
                  {f.title}
                </h3>
                <p className="text-[13px] leading-relaxed" style={{ color: '#6B7280' }}>
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-6 py-20" style={{ background: 'white' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div
              className="text-[11px] font-semibold uppercase tracking-[.1em] mb-3"
              style={{ color: '#028090' }}
            >
              Three steps
            </div>
            <h2
              className="text-[clamp(2rem,3vw+0.5rem,2.375rem)] font-bold tracking-[-0.02em]"
              style={{ color: '#0C1018' }}
            >
              From data to outreach in minutes
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                n: '01',
                title: 'Connect your EHR',
                body: 'Import patient data via CSV or Practice Fusion export. No complex integration required — your team is running in minutes.',
              },
              {
                n: '02',
                title: 'AI identifies the gaps',
                body: 'Our urgency algorithm flags overdue patients by clinical priority. Critical cases surface immediately; low-risk patients are scheduled thoughtfully.',
              },
              {
                n: '03',
                title: 'Reach out in seconds',
                body: 'Generate personalized scripts, mark contacted, track outreach. Full audit trail per patient, per clinic.',
              },
            ].map((step) => (
              <div key={step.n} className="flex flex-col">
                <div
                  className="text-[42px] font-bold font-mono tracking-tight mb-4"
                  style={{ color: 'rgba(2,128,144,0.2)' }}
                >
                  {step.n}
                </div>
                <h3 className="text-[16px] font-semibold mb-2" style={{ color: '#0C1018' }}>
                  {step.title}
                </h3>
                <p className="text-[13px] leading-relaxed" style={{ color: '#6B7280' }}>
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Clinic Types */}
      <section className="px-6 py-20" style={{ background: '#caf0f8' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div
              className="text-[11px] font-semibold uppercase tracking-[.1em] mb-3"
              style={{ color: '#028090' }}
            >
              Supported settings
            </div>
            <h2
              className="text-[clamp(2rem,3vw+0.5rem,2.375rem)] font-bold tracking-[-0.02em]"
              style={{ color: '#0C1018' }}
            >
              Built for community health
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                key: 'Pediatrics' as const,
                title: 'Pediatrics Clinics',
                items: ['Well-child visits', 'Immunization schedules', 'Developmental screenings'],
              },
              {
                key: 'Family Medicine' as const,
                title: 'Family Medicine',
                items: ['Annual physicals', 'Chronic care management', 'Preventive screenings'],
              },
              {
                key: 'Behavioral Health' as const,
                title: 'Behavioral Health',
                items: ['Therapy appointments', 'Medication management', 'Crisis follow-up'],
              },
            ].map((c) => (
              <div
                key={c.title}
                className="rounded-[6px] p-6"
                style={{ background: 'white', border: '1px solid rgba(2,128,144,0.15)' }}
              >
                <div
                  className="w-10 h-10 rounded-[6px] flex items-center justify-center mb-3"
                  style={{ background: 'rgba(2,128,144,0.08)' }}
                >
                  {CLINIC_ICONS[c.key]}
                </div>
                <h3 className="text-[15px] font-semibold mb-3" style={{ color: '#0C1018' }}>
                  {c.title}
                </h3>
                <ul className="flex flex-col gap-1.5">
                  {c.items.map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-2 text-[13px]"
                      style={{ color: '#374151' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
                        <path d="M2 6l3 3 5-5" stroke="#028090" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Request Access Form */}
      <section
        id="request-access"
        className="px-6 py-24"
        style={{ background: '#0C1018' }}
      >
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-10">
            <div
              className="text-[11px] font-semibold uppercase tracking-[.1em] mb-3"
              style={{ color: '#48cae4' }}
            >
              Get started
            </div>
            <h2
              className="text-[clamp(1.75rem,2.5vw+0.5rem,2rem)] font-bold tracking-[-0.02em] mb-3"
              style={{ color: '#F5F9F7' }}
            >
              Request access
            </h2>
            <p className="text-[14px] leading-relaxed" style={{ color: '#4A6580' }}>
              This is a demo product built for evaluation. Fill out the form and we&apos;ll be in touch.
            </p>
          </div>

          {submitted ? (
            <div
              className="rounded-[6px] p-8 text-center"
              style={{ background: 'rgba(2,128,144,0.1)', border: '1px solid rgba(2,128,144,0.25)' }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(2,128,144,0.2)' }}
              >
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <path d="M4 11l5 5 9-9" stroke="#48cae4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="text-[16px] font-semibold mb-2" style={{ color: '#F5F9F7' }}>
                Request received
              </div>
              <div className="text-[13px]" style={{ color: '#7D99B8' }}>
                Request received from <strong style={{ color: '#F5F9F7' }}>{formData.email}</strong>.
                We&apos;ll be in touch soon.
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium" style={{ color: '#8BA4C4' }}>
                    Clinic name <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.clinic_name}
                    onChange={(e) => set('clinic_name', e.target.value)}
                    placeholder="e.g. Riverside Community Health"
                    className="rounded-[4px] px-3 py-2.5 text-[13px] outline-none transition-colors placeholder:text-[#2E445A]"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#F5F9F7',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#028090')}
                    onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium" style={{ color: '#8BA4C4' }}>
                    Clinic type <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <select
                    required
                    value={formData.clinic_type}
                    onChange={(e) => set('clinic_type', e.target.value)}
                    className="rounded-[4px] px-3 py-2.5 text-[13px] outline-none transition-colors cursor-pointer"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: formData.clinic_type ? '#F5F9F7' : '#2E445A',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#028090')}
                    onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                  >
                    <option value="" disabled style={{ background: '#0C1018' }}>Select type</option>
                    {CLINIC_TYPES.map((t) => (
                      <option key={t} value={t} style={{ background: '#0C1018' }}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium" style={{ color: '#8BA4C4' }}>
                    Your name <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.admin_name}
                    onChange={(e) => set('admin_name', e.target.value)}
                    placeholder="Full name"
                    className="rounded-[4px] px-3 py-2.5 text-[13px] outline-none transition-colors placeholder:text-[#2E445A]"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#F5F9F7',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#028090')}
                    onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium" style={{ color: '#8BA4C4' }}>
                    Work email <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={(e) => set('email', e.target.value)}
                    placeholder="you@clinic.org"
                    className="rounded-[4px] px-3 py-2.5 text-[13px] outline-none transition-colors placeholder:text-[#2E445A]"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#F5F9F7',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#028090')}
                    onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium" style={{ color: '#8BA4C4' }}>
                    Phone <span style={{ color: '#4A6580' }}>(optional)</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="rounded-[4px] px-3 py-2.5 text-[13px] outline-none transition-colors placeholder:text-[#2E445A]"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#F5F9F7',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#028090')}
                    onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium" style={{ color: '#8BA4C4' }}>
                    Current EHR system
                  </label>
                  <select
                    value={formData.ehr_system}
                    onChange={(e) => set('ehr_system', e.target.value)}
                    className="rounded-[4px] px-3 py-2.5 text-[13px] outline-none transition-colors cursor-pointer"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: formData.ehr_system ? '#F5F9F7' : '#2E445A',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#028090')}
                    onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                  >
                    <option value="" style={{ background: '#0C1018' }}>Select EHR (optional)</option>
                    {EHR_OPTIONS.map((o) => (
                      <option key={o} value={o} style={{ background: '#0C1018' }}>{o}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-medium" style={{ color: '#8BA4C4' }}>
                  Anything else we should know <span style={{ color: '#4A6580' }}>(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={formData.message}
                  onChange={(e) => set('message', e.target.value)}
                  placeholder="Patient volume, specific use case, questions..."
                  className="rounded-[4px] px-3 py-2.5 text-[13px] outline-none transition-colors resize-none placeholder:text-[#2E445A]"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#F5F9F7',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#028090')}
                  onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                />
              </div>

              {submitError && (
                <div
                  className="text-[13px] px-4 py-3 rounded-[4px]"
                  style={{ background: 'rgba(220,38,38,0.1)', color: '#FCA5A5', border: '1px solid rgba(220,38,38,0.2)' }}
                >
                  {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-[6px] text-[14px] font-semibold transition-all mt-1"
                style={{
                  background: submitting ? 'rgba(2,128,144,0.5)' : '#028090',
                  color: 'white',
                  cursor: submitting ? 'wait' : 'pointer',
                }}
              >
                {submitting ? 'Sending…' : 'Request access'}
              </button>

              <p className="text-center text-[12px]" style={{ color: '#2E445A' }}>
                Already have an account?{' '}
                <Link href="/login" style={{ color: '#48cae4' }} className="hover:underline">
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer
        className="px-6 py-8"
        style={{ background: '#0A0A0A', borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col items-center md:items-start gap-1">
            <div className="flex items-center gap-2">
              <div
                className="w-5 h-5 rounded-[5px] flex items-center justify-center shrink-0"
                style={{ background: '#028090' }}
              >
                <svg width="10" height="10" viewBox="0 0 15 15" fill="none">
                  <circle cx="7.5" cy="5.5" r="3.2" stroke="white" strokeWidth="1.8" />
                  <path d="M2 15c0-3.04 2.46-5.5 5.5-5.5S13 11.96 13 15" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </div>
              <span className="text-[13px] font-semibold" style={{ color: '#8BA4C4' }}>
                Missing Patients by RPI
              </span>
            </div>
            <div className="text-[11px]" style={{ color: '#2E445A' }}>
              Built at the Lally AI Academy 2026
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-4 text-[12px]" style={{ color: '#4A6580' }}>
              <Link href="/login" className="hover:underline" style={{ color: '#4A6580' }}>
                Sign In
              </Link>
              <button
                onClick={scrollToForm}
                className="hover:underline"
                style={{ color: '#4A6580', background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}
              >
                Request Access
              </button>
              <a
                href="https://github.com/Chikelly-S/Group5_2026"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                style={{ color: '#4A6580' }}
              >
                GitHub
              </a>
            </div>
            <div className="text-[11px]" style={{ color: '#2E445A' }}>
              Built with Next.js, Supabase, and Anthropic Claude
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
