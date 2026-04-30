import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import TopNav from '@/components/TopNav'
import Sidebar from '@/components/Sidebar'
import { ClinicProvider } from '@/context/ClinicContext'
import { SidebarProvider } from '@/context/SidebarContext'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Missing Patients',
  description: 'Missing patients clinical outreach tool',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-screen overflow-hidden bg-[#f8fafc] grid grid-rows-[56px_1fr] grid-cols-1 md:grid-cols-[220px_1fr]">
        <ClinicProvider>
          <SidebarProvider>
            <TopNav />
            <Suspense fallback={<aside className="hidden md:block" style={{ background: '#ffffff', borderRight: '1px solid #e2e8f0' }} />}>
              <Sidebar />
            </Suspense>
            <main className="overflow-y-auto">{children}</main>
          </SidebarProvider>
        </ClinicProvider>
      </body>
    </html>
  )
}
