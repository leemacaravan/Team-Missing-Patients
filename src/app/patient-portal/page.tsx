'use client'

import { useState, useEffect } from 'react'

type PortalData = {
  firstName: string
  lastName: string
  patientIdentifier: string
  mostRecentVisitDate: string | null
  lastEncounterDate: string | null
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function isPast(dateStr: string): boolean {
  return new Date(dateStr + 'T12:00:00') < new Date()
}

export default function PatientPortalPage() {
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  useEffect(() => {
    async function load() {
      const meRes = await fetch('/api/auth/me')
      if (!meRes.ok) { window.location.replace('/login'); return }
      const { user } = await meRes.json()
      if (!user || user.role !== 'patient') { window.location.replace('/login'); return }

      const res = await fetch('/api/patient-portal')
      if (res.status === 404) { setNotFound(true); setLoading(false); return }
      if (!res.ok) { setNotFound(true); setLoading(false); return }

      const json = await res.json()
      setData(json)
      setLoading(false)
    }
    load()
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.replace('/login')
  }

  function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    setSent(true)
  }

  // Loading
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: '#f0f9ff' }}>
        <p style={{ color: '#9CA3AF', fontSize: '15px' }}>Loading your health record…</p>
      </div>
    )
  }

  // Not found — friendly, not red
  if (notFound || !data) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6" style={{ background: '#f0f9ff' }}>
        <div
          className="w-full max-w-sm rounded-xl p-8 text-center"
          style={{ background: 'white', border: '1px solid #e2e8f0' }}
        >
          <Logo />
          <p style={{ color: '#6B7280', fontSize: '16px', lineHeight: '1.6', marginTop: '24px' }}>
            We couldn&apos;t find your record.
            <br />
            Please call your clinic directly to confirm your patient ID.
          </p>
          <button
            onClick={handleLogout}
            style={{ color: '#9CA3AF', fontSize: '13px', marginTop: '24px', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  const nextDueDate = data.mostRecentVisitDate ? addDays(data.mostRecentVisitDate, 365) : null
  const overdue = nextDueDate ? isPast(nextDueDate) : false

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: '#f0f9ff' }}>
      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => { setShowModal(false); setSent(false); setMessage('') }}
        >
          <div
            className="w-full max-w-sm rounded-xl p-7"
            style={{ background: 'white' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111', marginBottom: '16px' }}>
              Request an Appointment
            </h2>

            {sent ? (
              <p style={{ fontSize: '16px', color: '#374151', lineHeight: '1.6' }}>
                Thank you! We will be in touch within 1 business day.
              </p>
            ) : (
              <>
                <p style={{ fontSize: '15px', color: '#6B7280', marginBottom: '20px' }}>
                  To schedule your appointment, you can reach us at:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                  <div style={{ fontSize: '15px', color: '#374151' }}>
                    <strong>Phone:</strong> (518) 000-0000
                  </div>
                  <div style={{ fontSize: '15px', color: '#374151' }}>
                    <strong>Email:</strong> clinic@example.com
                  </div>
                </div>
                <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '8px' }}>
                  Or leave a message and we will call you back:
                </p>
                <form onSubmit={handleSendMessage}>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    placeholder="Type your message here…"
                    style={{
                      width: '100%',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      fontSize: '14px',
                      color: '#111',
                      resize: 'none',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!message.trim()}
                    style={{
                      marginTop: '12px',
                      width: '100%',
                      background: message.trim() ? '#028090' : '#e2e8f0',
                      color: message.trim() ? 'white' : '#9CA3AF',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '12px',
                      fontSize: '15px',
                      fontWeight: 600,
                      cursor: message.trim() ? 'pointer' : 'default',
                    }}
                  >
                    Submit
                  </button>
                </form>
              </>
            )}

            <button
              onClick={() => { setShowModal(false); setSent(false); setMessage('') }}
              style={{
                marginTop: '16px',
                width: '100%',
                background: 'none',
                border: 'none',
                color: '#9CA3AF',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Page */}
      <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 16px 60px' }}>
        {/* Logo */}
        <Logo />

        {/* Greeting */}
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#111', marginTop: '28px', marginBottom: '32px', textAlign: 'center' }}>
          Hello, {data.firstName}
        </h1>

        {/* Card */}
        <div
          style={{
            width: '100%',
            maxWidth: '440px',
            background: 'white',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
          }}
        >
          {/* Last Visit */}
          <Section label="Last Visit">
            {data.lastEncounterDate ? (
              <p style={{ fontSize: '18px', color: '#111', fontWeight: 500 }}>
                Your last visit was <strong>{formatDate(data.lastEncounterDate)}</strong>
              </p>
            ) : (
              <p style={{ fontSize: '17px', color: '#6B7280' }}>No visit history on file</p>
            )}
          </Section>

          <Divider />

          {/* Next Visit Due */}
          <Section label="Next Visit Due">
            {nextDueDate ? (
              overdue ? (
                <p style={{ fontSize: '18px', color: '#B91C1C', fontWeight: 500 }}>
                  Your well visit was due by <strong>{formatDate(nextDueDate)}</strong>.
                  <br />
                  <span style={{ fontSize: '15px', fontWeight: 400 }}>Please schedule your visit soon.</span>
                </p>
              ) : (
                <p style={{ fontSize: '18px', color: '#111', fontWeight: 500 }}>
                  Your next well visit is due by <strong>{formatDate(nextDueDate)}</strong>
                </p>
              )
            ) : (
              <p style={{ fontSize: '17px', color: '#6B7280' }}>No upcoming visits on file</p>
            )}
          </Section>

          <Divider />

          {/* Request Appointment */}
          <Section label="Schedule a Visit">
            <button
              onClick={() => setShowModal(true)}
              style={{
                width: '100%',
                background: '#028090',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '16px',
                fontSize: '17px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Request an Appointment
            </button>
          </Section>
        </div>

        {/* Sign out */}
        <button
          onClick={handleLogout}
          style={{
            marginTop: '32px',
            color: '#9CA3AF',
            fontSize: '14px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div
        style={{
          width: '32px',
          height: '32px',
          background: '#028090',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 15 15" fill="none">
          <circle cx="7.5" cy="5.5" r="3.2" stroke="white" strokeWidth="1.6" />
          <path d="M2 15c0-3.04 2.46-5.5 5.5-5.5S13 11.96 13 15" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
      <span style={{ fontSize: '16px', fontWeight: 600, color: '#111' }}>Missing Patients</span>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '28px 28px' }}>
      <p style={{ fontSize: '12px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
        {label}
      </p>
      {children}
    </div>
  )
}

function Divider() {
  return <div style={{ height: '1px', background: '#f3f4f6' }} />
}
