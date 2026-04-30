import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth'

const PUBLIC_PATHS = new Set(['/', '/login'])

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value)

  if (!hasSession && !PUBLIC_PATHS.has(pathname)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (hasSession && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (hasSession && pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/',
    '/dashboard/:path*',
    '/all-patients/:path*',
    '/encounters/:path*',
    '/reports/:path*',
    '/profile/:path*',
    '/patients/new/:path*',
    '/patient-portal',
    '/patient-portal/:path*',
    '/login',
  ],
}
