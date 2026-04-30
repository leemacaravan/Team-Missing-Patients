'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useClinic } from '@/context/ClinicContext'
import { useSidebar } from '@/context/SidebarContext'

export default function Sidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [exportMsg, setExportMsg] = useState<string | null>(null)
  const isAdmin = useMemo(() => typeof window !== 'undefined' && document.cookie.includes('mp_session='), [])
  const { clinicId, clinicName } = useClinic()
  const { isOpen, close } = useSidebar()

  useEffect(() => {
    close()
  }, [pathname, searchParams, close])

  if (pathname === '/' || pathname === '/login' || pathname === '/request-access' || pathname.startsWith('/patient-portal')) return null

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.replace('/login')
  }

  async function exportCsv() {
    setExportMsg('Exporting…')
    try {
      const res = await fetch('/api/patients/export')
      if (!res.ok) { setExportMsg('Export failed'); setTimeout(() => setExportMsg(null), 3000); return }
      const totalHeader = res.headers.get('X-Total-Count')
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename="([^"]+)"/)
      const filename = match?.[1] ?? 'patients.csv'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
      const count = totalHeader ?? '?'
      setExportMsg(`Exported ${count} patients`)
    } catch {
      setExportMsg('Export failed')
    }
    setTimeout(() => setExportMsg(null), 3000)
  }

  const isDashboard = pathname === '/dashboard'
  const isAllPatients = pathname === '/all-patients'
  const isContacted = pathname === '/alerts' && searchParams.get('filter') === 'contacted'
  const isAlerts = pathname === '/alerts'
  const isEncounters = pathname === '/encounters'
  const isReports = pathname === '/reports'
  const isAddPatient = pathname === '/patients/new'
  const isUpload = pathname === '/upload'
  const isProfile = pathname === '/profile'

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[55] bg-black/50 md:hidden"
          onClick={close}
        />
      )}

      <aside
        className={[
          'fixed inset-y-0 left-0 w-[260px] z-[60]',
          'transition-transform duration-200 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'md:relative md:inset-auto md:translate-x-0 md:z-auto md:w-auto',
          'flex flex-col overflow-y-auto',
        ].join(' ')}
        style={{ background: '#ffffff', borderRight: '1px solid #e2e8f0' }}
      >
        {/* Clinic header */}
        {clinicId && (
          <div className="px-3.5 py-3" style={{ borderBottom: '1px solid #e2e8f0' }}>
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0"
                style={{ background: '#0077b6' }}
              >
                <span className="text-[11px] font-bold" style={{ color: '#FFFFFF' }}>
                  {clinicName
                    ? clinicName.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
                    : '??'}
                </span>
              </div>
              <div>
                <div className="text-[11px] font-semibold leading-tight" style={{ color: '#0f172a' }}>{clinicName}</div>
                <div className="text-[9px] uppercase tracking-[.06em] mt-px" style={{ color: '#94a3b8' }}>Active clinic</div>
              </div>
            </div>
          </div>
        )}

        <div className="px-2.5 py-4 flex flex-col gap-0.5 flex-1">
          <span className="text-[9px] uppercase tracking-[.1em] px-2.5 mb-1 mt-1 block" style={{ color: '#94a3b8' }}>Overview</span>

          <NavLink
            href="/dashboard"
            active={isDashboard}
            icon={
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <rect x="1" y="1" width="5.5" height="5.5" rx="1.2" stroke={isDashboard ? '#0077b6' : '#6b7280'} strokeWidth="1.4" />
                <rect x="8.5" y="1" width="5.5" height="5.5" rx="1.2" stroke={isDashboard ? '#0077b6' : '#6b7280'} strokeWidth="1.4" />
                <rect x="1" y="8.5" width="5.5" height="5.5" rx="1.2" stroke={isDashboard ? '#0077b6' : '#6b7280'} strokeWidth="1.4" />
                <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.2" stroke={isDashboard ? '#0077b6' : '#6b7280'} strokeWidth="1.4" />
              </svg>
            }
            label="Dashboard"
          />

          <NavLink
            href="/all-patients"
            active={isAllPatients}
            icon={
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <circle cx="7.5" cy="5" r="3" stroke={isAllPatients ? '#0077b6' : '#6b7280'} strokeWidth="1.4" />
                <path d="M2 14c0-3.04 2.46-5.5 5.5-5.5S13 10.96 13 14" stroke={isAllPatients ? '#0077b6' : '#6b7280'} strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            }
            label="All patients"
          />

          <NavLink
            href="/alerts?filter=contacted"
            active={isContacted}
            icon={
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M7.5 1.5C4.46 1.5 2 3.96 2 7c0 1.04.3 2.01.82 2.83L2 13.5l3.67-.82A5.47 5.47 0 007.5 13.5C10.54 13.5 13 11.04 13 8s-2.46-6.5-5.5-6.5z"
                  stroke={isContacted ? '#0077b6' : '#6b7280'} strokeWidth="1.3" strokeLinejoin="round"/>
                <path d="M5.5 7.5h4M5.5 9.5h2.5" stroke={isContacted ? '#0077b6' : '#6b7280'} strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            }
            label="Contacted"
          />

          <NavLink
            href="/encounters"
            active={isEncounters}
            icon={
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <rect x="2" y="2.5" width="11" height="10.5" rx="1.3" stroke={isEncounters ? '#0077b6' : '#6b7280'} strokeWidth="1.3" />
                <path d="M5 1.5v2M10 1.5v2M2 6h11" stroke={isEncounters ? '#0077b6' : '#6b7280'} strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            }
            label="Encounters"
          />

          <NavLink
            href="/reports"
            active={isReports}
            icon={
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M2.5 12.5h10M4.5 10V7.5M7.5 10V5M10.5 10V3.5" stroke={isReports ? '#0077b6' : '#6b7280'} strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            }
            label="Reports"
          />

          <div className="h-px my-2 mx-1" style={{ background: '#e2e8f0' }} />
          <span className="text-[9px] uppercase tracking-[.1em] px-2.5 mb-1 block" style={{ color: '#94a3b8' }}>Tools</span>

          {isAdmin && (
            <NavLink
              href="/patients/new"
              active={isAddPatient}
              icon={
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <circle cx="7.5" cy="7.5" r="6" stroke={isAddPatient ? '#0077b6' : '#6b7280'} strokeWidth="1.3" />
                  <path d="M7.5 4.5v6M4.5 7.5h6" stroke={isAddPatient ? '#0077b6' : '#6b7280'} strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              }
              label="+ Add Patient"
            />
          )}

          <NavLink
            href="/upload"
            active={isUpload}
            icon={
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M2.5 10.5v2a1 1 0 001 1h8a1 1 0 001-1v-2" stroke={isUpload ? '#0077b6' : '#6b7280'} strokeWidth="1.4" strokeLinecap="round" />
                <path d="M7.5 2v7M4.5 6l3 3 3-3" stroke={isUpload ? '#0077b6' : '#6b7280'} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
            label="Upload CSV"
          />

          <button
            onClick={exportCsv}
            className="w-full flex flex-col gap-0.5 px-2.5 py-2 rounded-[4px] text-[13px] transition-colors cursor-pointer"
            style={{ color: '#6b7280' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#374151' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#6b7280' }}
          >
            <div className="flex items-center gap-2.5">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="shrink-0">
                <path d="M2.5 11.5v1a1 1 0 001 1h8a1 1 0 001-1v-1M7.5 2.5v7M4.5 6.5l3-3 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Export report
            </div>
            {exportMsg && <div className="text-[10px] pl-[23px]" style={{ color: '#0077b6' }}>{exportMsg}</div>}
          </button>

          <div className="h-px my-2 mx-1" style={{ background: '#e2e8f0' }} />

          <NavLink
            href="/profile"
            active={isProfile}
            icon={
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <circle cx="7.5" cy="5.1" r="2.6" stroke={isProfile ? '#0077b6' : '#6b7280'} strokeWidth="1.4" />
                <path d="M2.6 13.5c.3-2.5 2.4-4.2 4.9-4.2s4.6 1.7 4.9 4.2" stroke={isProfile ? '#0077b6' : '#6b7280'} strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            }
            label="Admin Profile"
          />

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[4px] text-[13px] transition-colors cursor-pointer"
            style={{ color: '#6b7280' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#6b7280' }}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="shrink-0">
              <path d="M5.5 2.5H3a1 1 0 00-1 1v8a1 1 0 001 1h2.5M10 10.5l3-3-3-3M13 7.5H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Switch Clinic / Logout
          </button>
        </div>
      </aside>
    </>
  )
}

function NavLink({
  href,
  active,
  icon,
  label,
  badge,
  badgeClass,
  onClick,
}: {
  href: string
  active: boolean
  icon: React.ReactNode
  label: string
  badge?: string
  badgeClass?: string
  onClick?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-[4px] text-[13px] transition-colors"
      style={{
        background: active ? '#f0f9ff' : 'transparent',
        borderLeft: active ? '3px solid #0077b6' : '3px solid transparent',
        color: active ? '#0077b6' : '#6b7280',
        fontWeight: active ? 500 : 400,
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = '#f8fafc'
          e.currentTarget.style.color = '#374151'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = '#6b7280'
        }
      }}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge && (
        <span className={`text-[10px] px-[7px] py-px rounded-full font-semibold font-mono ${badgeClass}`}>
          {badge}
        </span>
      )}
    </Link>
  )
}
