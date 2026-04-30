'use client'

import { useState, useEffect, useRef } from 'react'
import { Phone, Mail } from 'lucide-react'

type DemoClinic = {
  name: string
  email: string
  password: string
}

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '')
}

function maskPhone(digits: string): string {
  const d = digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits
  return `***-***-${d.slice(-4)}`
}

export default function LoginPage() {
  const [tab, setTab] = useState<'clinic' | 'patient'>('clinic')

  // Clinic
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [clinicError, setClinicError] = useState('')
  const [clinicLoading, setClinicLoading] = useState(false)

  // Demo
  const [demoOpen, setDemoOpen] = useState(false)
  const [demoClinics, setDemoClinics] = useState<DemoClinic[]>([])
  const [demoLoaded, setDemoLoaded] = useState(false)

  // Patient
  const [patientSubTab, setPatientSubTab] = useState<'phone' | 'email'>('phone')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [phoneStep, setPhoneStep] = useState<1 | 2>(1)
  const [maskedPhone, setMaskedPhone] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [patientEmail, setPatientEmail] = useState('')
  const [patientDob, setPatientDob] = useState('')
  const [patientError, setPatientError] = useState('')
  const [patientLoading, setPatientLoading] = useState(false)

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (demoOpen && !demoLoaded) {
      fetch('/api/auth/demo-info')
        .then((r) => r.json())
        .then((d) => {
          setDemoClinics(d.clinics ?? [])
          setDemoLoaded(true)
        })
    }
  }, [demoOpen, demoLoaded])

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  function startCountdown() {
    setCountdown(60)
    if (countdownRef.current) clearInterval(countdownRef.current)
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(countdownRef.current!); return 0 }
        return c - 1
      })
    }, 1000)
  }

  async function doClinicLogin(body: Record<string, string>) {
    setClinicLoading(true)
    setClinicError('')
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setClinicLoading(false)
    if (!res.ok) { setClinicError(data.error ?? 'Login failed'); return }
    window.location.replace('/dashboard')
  }

  async function onClinicSubmit(e: React.FormEvent) {
    e.preventDefault()
    await doClinicLogin({ email, password, role: 'clinic' })
  }

  async function quickLogin(clinic: DemoClinic) {
    await doClinicLogin({ email: clinic.email, password: clinic.password, role: 'clinic' })
  }

  async function sendOtp() {
    const digits = normalizePhone(phoneNumber)
    if (digits.length < 10) {
      setPatientError('Please enter a valid 10-digit phone number')
      return
    }
    setPatientLoading(true)
    setPatientError('')
    const res = await fetch('/api/patient/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: digits }),
    })
    setPatientLoading(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setPatientError(d.error ?? 'Failed to send code')
      return
    }
    setMaskedPhone(maskPhone(digits))
    setPhoneStep(2)
    startCountdown()
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault()
    if (otpCode.length !== 6) return
    setPatientLoading(true)
    setPatientError('')
    const res = await fetch('/api/patient/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: normalizePhone(phoneNumber), code: otpCode }),
    })
    const data = await res.json()
    setPatientLoading(false)
    if (!res.ok) { setPatientError(data.error ?? 'Verification failed'); return }
    window.location.replace('/patient-portal')
  }

  async function verifyEmail(e: React.FormEvent) {
    e.preventDefault()
    setPatientLoading(true)
    setPatientError('')
    const res = await fetch('/api/patient/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: patientEmail, date_of_birth: patientDob }),
    })
    const data = await res.json()
    setPatientLoading(false)
    if (!res.ok) { setPatientError(data.error ?? 'Verification failed'); return }
    window.location.replace('/patient-portal')
  }

  function switchTab(next: 'clinic' | 'patient') {
    setTab(next)
    setClinicError('')
    setPatientError('')
  }

  function switchPatientSubTab(next: 'phone' | 'email') {
    setPatientSubTab(next)
    setPatientError('')
    setPhoneStep(1)
    setOtpCode('')
  }

  const inputCls = 'w-full border border-[#e2e8f0] px-3 py-2.5 text-[13px] text-[#111] bg-white focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090] transition-colors rounded-[4px]'
  const phoneDigits = normalizePhone(phoneNumber)

  return (
    <div className="fixed inset-0 flex">
      {/* Left panel */}
      <div
        className="hidden md:flex md:w-[40%] flex-col justify-between p-12"
        style={{ background: '#03045e' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-[4px] flex items-center justify-center shrink-0" style={{ background: '#028090' }}>
            <svg width="16" height="16" viewBox="0 0 15 15" fill="none">
              <circle cx="7.5" cy="5.5" r="3.2" stroke="white" strokeWidth="1.6" />
              <path d="M2 15c0-3.04 2.46-5.5 5.5-5.5S13 11.96 13 15" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <span className="text-[14px] font-semibold tracking-tight" style={{ color: 'rgba(255,255,255,0.88)' }}>
            Missing Patients
          </span>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.12em] mb-6" style={{ color: '#00b4d8' }}>
            Community Health Outreach
          </p>
          <p className="text-[34px] font-semibold leading-[1.15] tracking-tight mb-9" style={{ color: 'rgba(255,255,255,0.95)' }}>
            Close care gaps.<br />Reach patients<br />before they&apos;re lost.
          </p>
          <div className="flex flex-col gap-5" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '28px' }}>
            {[
              { label: 'Multilingual', detail: "AI phone scripts in the patient's preferred language" },
              { label: 'Urgency-aware', detail: 'Prioritized by days overdue and clinical risk level' },
              { label: 'FQHC-ready', detail: 'Built for community and federally qualified health centers' },
            ].map(({ label, detail }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="w-[5px] h-[5px] rounded-full mt-[5px] shrink-0" style={{ background: '#00b4d8' }} />
                <div>
                  <div className="text-[13px] font-semibold leading-tight" style={{ color: 'rgba(255,255,255,0.88)' }}>{label}</div>
                  <div className="text-[12px] mt-0.5 leading-snug" style={{ color: 'rgba(255,255,255,0.38)' }}>{detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[10px] uppercase tracking-[.1em]" style={{ color: 'rgba(255,255,255,0.18)' }}>
          Lally AI Academy 2026
        </p>
      </div>

      {/* Right panel */}
      <div
        className="flex-1 flex items-start md:items-center justify-center p-6 md:p-14 overflow-y-auto"
        style={{ background: '#f8fafc' }}
      >
        <div className="w-full max-w-[340px] py-10 md:py-0">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-10 md:hidden">
            <div className="w-7 h-7 rounded-[4px] flex items-center justify-center shrink-0" style={{ background: '#028090' }}>
              <svg width="16" height="16" viewBox="0 0 15 15" fill="none">
                <circle cx="7.5" cy="5.5" r="3.2" stroke="white" strokeWidth="1.6" />
                <path d="M2 15c0-3.04 2.46-5.5 5.5-5.5S13 11.96 13 15" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-[15px] font-semibold" style={{ color: '#111' }}>Missing Patients</span>
          </div>

          {/* Top-level tabs */}
          <div className="flex items-end gap-6 mb-7" style={{ borderBottom: '1px solid #e2e8f0' }}>
            {(['clinic', 'patient'] as const).map((t) => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className="pb-3 text-[13px] font-medium transition-colors whitespace-nowrap"
                style={{
                  color: tab === t ? '#028090' : '#9CA3AF',
                  borderBottom: tab === t ? '2px solid #028090' : '2px solid transparent',
                  marginBottom: '-1px',
                }}
              >
                {t === 'clinic' ? 'Clinic Staff' : 'Patient Portal'}
              </button>
            ))}
          </div>

          <h1 className="text-[22px] font-semibold tracking-tight mb-6" style={{ color: '#111' }}>
            {tab === 'clinic' ? 'Sign in to your clinic' : 'View your health record'}
          </h1>

          {tab === 'clinic' ? (
            <form onSubmit={onClinicSubmit} className="flex flex-col gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Work email"
                required
                autoComplete="email"
                className={inputCls}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                autoComplete="current-password"
                className={inputCls}
              />
              {clinicError && <p className="text-[12px] mt-0.5" style={{ color: '#B91C1C' }}>{clinicError}</p>}
              <button
                type="submit"
                disabled={clinicLoading}
                className="w-full mt-2 text-white text-[13px] font-medium px-3 py-2.5 rounded-[4px] transition-colors disabled:opacity-60"
                style={{ background: '#028090' }}
                onMouseEnter={(e) => { if (!clinicLoading) (e.currentTarget as HTMLButtonElement).style.background = '#025f6b' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#028090' }}
              >
                {clinicLoading ? 'Signing in…' : 'Sign in'}
              </button>
              <p className="text-center text-[12px] mt-1" style={{ color: '#9CA3AF' }}>
                No account?{' '}
                <a href="/request-access" className="font-medium hover:underline" style={{ color: '#028090' }}>
                  Request access
                </a>
              </p>
            </form>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Patient sub-tabs */}
              <div className="flex gap-1 p-1 rounded-[6px]" style={{ background: '#f1f5f9' }}>
                {(['phone', 'email'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => switchPatientSubTab(st)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[12px] font-medium rounded-[4px] transition-all"
                    style={{
                      background: patientSubTab === st ? 'white' : 'transparent',
                      color: patientSubTab === st ? '#028090' : '#6B7280',
                      boxShadow: patientSubTab === st ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    }}
                  >
                    {st === 'phone' ? <Phone size={13} /> : <Mail size={13} />}
                    {st === 'phone' ? 'Phone' : 'Email'}
                  </button>
                ))}
              </div>

              {patientSubTab === 'phone' ? (
                phoneStep === 1 ? (
                  <div className="flex flex-col gap-3">
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="(555) 000-0000"
                      autoComplete="tel"
                      className={inputCls}
                    />
                    {patientError && <p className="text-[12px]" style={{ color: '#B91C1C' }}>{patientError}</p>}
                    <button
                      onClick={sendOtp}
                      disabled={patientLoading || phoneDigits.length < 10}
                      className="w-full text-white text-[13px] font-medium px-3 py-2.5 rounded-[4px] transition-colors disabled:opacity-60"
                      style={{ background: '#028090' }}
                    >
                      {patientLoading ? 'Sending…' : 'Send code'}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={verifyOtp} className="flex flex-col gap-3">
                    <p className="text-[12px]" style={{ color: '#6B7280' }}>
                      Code sent to{' '}
                      <span className="font-mono font-medium" style={{ color: '#374151' }}>{maskedPhone}</span>
                    </p>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      autoComplete="one-time-code"
                      autoFocus
                      className={`${inputCls} font-mono text-[20px] tracking-[0.3em] text-center py-3`}
                    />
                    {patientError && <p className="text-[12px]" style={{ color: '#B91C1C' }}>{patientError}</p>}
                    <button
                      type="submit"
                      disabled={patientLoading || otpCode.length !== 6}
                      className="w-full text-white text-[13px] font-medium px-3 py-2.5 rounded-[4px] transition-colors disabled:opacity-60"
                      style={{ background: '#028090' }}
                    >
                      {patientLoading ? 'Verifying…' : 'Verify'}
                    </button>
                    <div className="text-center">
                      {countdown > 0 ? (
                        <p className="text-[12px]" style={{ color: '#9CA3AF' }}>
                          Resend code in {countdown}s
                        </p>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setOtpCode(''); sendOtp() }}
                          className="text-[12px] font-medium"
                          style={{ color: '#028090', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          Resend code
                        </button>
                      )}
                    </div>
                  </form>
                )
              ) : (
                <form onSubmit={verifyEmail} className="flex flex-col gap-3">
                  <input
                    type="email"
                    value={patientEmail}
                    onChange={(e) => setPatientEmail(e.target.value)}
                    placeholder="Email address on file"
                    required
                    autoComplete="email"
                    className={inputCls}
                  />
                  <input
                    type="date"
                    value={patientDob}
                    onChange={(e) => setPatientDob(e.target.value)}
                    required
                    className={inputCls}
                  />
                  {patientError && <p className="text-[12px]" style={{ color: '#B91C1C' }}>{patientError}</p>}
                  <button
                    type="submit"
                    disabled={patientLoading || !patientEmail || !patientDob}
                    className="w-full text-white text-[13px] font-medium px-3 py-2.5 rounded-[4px] transition-colors disabled:opacity-60"
                    style={{ background: '#028090' }}
                  >
                    {patientLoading ? 'Verifying…' : 'Access my records'}
                  </button>
                </form>
              )}

              <p className="text-[11px] leading-snug" style={{ color: '#9CA3AF' }}>
                Your identity is verified using information on file with your clinic. No password required.
              </p>
            </div>
          )}

          {/* Demo access */}
          <div className="mt-8 rounded-[4px] border border-[#e2e8f0] bg-white overflow-hidden">
            <button
              onClick={() => setDemoOpen((o) => !o)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#f8fafc] transition-colors"
            >
              <span className="text-[12px]" style={{ color: '#9CA3AF' }}>Demo access for evaluation</span>
              <svg
                className={`w-3 h-3 transition-transform duration-200 ${demoOpen ? 'rotate-180' : ''}`}
                style={{ color: '#9CA3AF' }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
              </svg>
            </button>
            {demoOpen && (
              <div className="flex flex-col gap-2 px-4 pb-4 pt-2" style={{ borderTop: '1px solid #e2e8f0' }}>
                {!demoLoaded ? (
                  <div className="text-[12px] text-center py-2" style={{ color: '#9CA3AF' }}>Loading…</div>
                ) : (
                  demoClinics.map((c) => (
                    <div
                      key={c.email}
                      className="rounded-[4px] border border-[#e2e8f0] px-3 py-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-[12px] font-medium truncate" style={{ color: '#111' }}>{c.name}</div>
                        <div className="text-[11px] font-mono mt-0.5 truncate" style={{ color: '#9CA3AF' }}>{c.email}</div>
                        <div className="text-[11px] font-mono" style={{ color: '#9CA3AF' }}>pw: {c.password}</div>
                      </div>
                      <button
                        onClick={() => quickLogin(c)}
                        disabled={clinicLoading}
                        className="shrink-0 text-[11px] font-medium rounded-[4px] px-2.5 py-1.5 hover:bg-[#f0f9ff] disabled:opacity-60 transition-colors"
                        style={{ color: '#028090', border: '1px solid #e2e8f0' }}
                      >
                        {clinicLoading ? '…' : 'Log in'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <p className="text-center text-[11px] mt-6" style={{ color: '#cbd5e1' }}>Lally AI Academy 2026</p>
        </div>
      </div>
    </div>
  )
}
