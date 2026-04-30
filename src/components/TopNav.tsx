'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSidebar } from '@/context/SidebarContext'

export default function TopNav() {
  const pathname = usePathname()
  const { toggle } = useSidebar()

  if (pathname === '/' || pathname === '/login' || pathname === '/request-access' || pathname.startsWith('/patient-portal')) return null

  return (
    <header
      className="flex items-center"
      style={{ gridColumn: '1 / -1', background: '#1a1a2e', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* Hamburger — mobile only */}
      <button
        onClick={toggle}
        className="md:hidden ml-3 w-9 h-9 shrink-0 flex items-center justify-center rounded-[4px] transition-colors"
        style={{ color: 'rgba(255,255,255,0.7)' }}
        aria-label="Toggle menu"
      >
        <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
          <path d="M1 1h16M1 7h16M1 13h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>

      {/* Logo — matches sidebar width on desktop */}
      <Link
        href="/dashboard"
        className="flex items-center gap-2.5 px-4 h-full shrink-0 transition-opacity hover:opacity-80 md:w-[220px]"
        style={{ borderRight: '1px solid rgba(255,255,255,0.1)' }}
      >
        <div className="w-6 h-6 rounded-[6px] flex items-center justify-center shrink-0" style={{ background: '#028090' }}>
          <svg width="13" height="13" viewBox="0 0 15 15" fill="none">
            <circle cx="7.5" cy="5.5" r="3.2" stroke="white" strokeWidth="1.6" />
            <path d="M2 15c0-3.04 2.46-5.5 5.5-5.5S13 11.96 13 15" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <div className="text-[14px] font-semibold tracking-tight leading-none" style={{ color: '#FFFFFF' }}>Missing Patients</div>
          <div className="text-[9px] mt-px" style={{ color: 'rgba(255,255,255,0.5)' }}>by RPI</div>
        </div>
      </Link>

      <div className="flex-1" />
    </header>
  )
}
