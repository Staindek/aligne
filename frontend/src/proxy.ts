import { NextRequest, NextResponse } from 'next/server'
import { Session } from '@/lib/definitions'

const PUBLIC_ROUTES = ['/login', '/register']

const ROLE_HOME: Record<string, string> = {
  admin: '/admin',
  instructor: '/instructor',
  student: '/student',
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r))

  const raw = request.cookies.get('pilates_session')?.value
  const session: Session | null = raw
    ? (() => { try { return JSON.parse(raw) } catch { return null } })()
    : null

  // Sin sesión → solo rutas públicas
  if (!session) {
    if (isPublic) return NextResponse.next()
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Con sesión en ruta pública → redirigir al home del rol
  if (isPublic) {
    const home = ROLE_HOME[session.user.role] ?? '/login'
    return NextResponse.redirect(new URL(home, request.url))
  }

  // Verificar que el rol coincide con la sección que visita
  const role = session.user.role
  if (pathname.startsWith('/admin') && role !== 'admin')
    return NextResponse.redirect(new URL(ROLE_HOME[role] ?? '/login', request.url))
  if (pathname.startsWith('/instructor') && role !== 'instructor' && role !== 'admin')
    return NextResponse.redirect(new URL(ROLE_HOME[role] ?? '/login', request.url))

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
