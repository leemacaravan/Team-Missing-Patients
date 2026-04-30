import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const SESSION_COOKIE = 'mp_session'
const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? 'dev-only-secret-change-me')

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/all-patients',
  '/alerts',
  '/patients',
  '/encounters',
  '/reports',
  '/import',
  '/upload',
  '/profile',
]

async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (!token) return false
  try {
    await jwtVerify(token, secret)
    return true
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const authed = await isAuthenticated(request)

  if (pathname === '/' && authed) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
  )
  if (isProtected && !authed) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/',
    '/dashboard/:path*',
    '/all-patients/:path*',
    '/alerts/:path*',
    '/patients/:path*',
    '/encounters/:path*',
    '/reports/:path*',
    '/import/:path*',
    '/upload/:path*',
    '/profile/:path*',
  ],
}
