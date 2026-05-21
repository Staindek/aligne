import 'server-only'
import { cookies } from 'next/headers'
import { Session, SessionUser } from './definitions'

const COOKIE_NAME = 'pilates_session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 días

export async function createSession(token: string, user: SessionUser): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, JSON.stringify({ token, user }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(COOKIE_NAME)?.value
  if (!raw) return null
  try {
    return JSON.parse(raw) as Session
  } catch {
    return null
  }
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
