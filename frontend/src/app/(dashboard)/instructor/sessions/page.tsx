import { getSession } from '@/lib/session'
import { schedulesApi, bookingsApi, classesApi } from '@/lib/api'
import type { Booking } from '@/lib/definitions'
import SessionsClient from './sessions-client'

const ACTIONABLE_LOOKBACK_DAYS = 30

function scheduleStart(date: string, startTime: string): number {
  return new Date(`${date}T${startTime.substring(0, 5)}:00`).getTime()
}

export default async function InstructorSessionsPage() {
  const session = (await getSession())!
  const [allSchedules, classes] = await Promise.all([
    schedulesApi.list(session.token).catch(() => []),
    classesApi.list(session.token).catch(() => []),
  ])

  const mySchedules = allSchedules.filter(
    (s) => s.instructor.email === session.user.email,
  )

  const now = Date.now()
  const lookback = new Date()
  lookback.setDate(lookback.getDate() - ACTIONABLE_LOOKBACK_DAYS)
  const lookbackISO = lookback.toISOString().slice(0, 10)

  const pastRecent = mySchedules.filter(
    (s) => s.date >= lookbackISO && scheduleStart(s.date, s.startTime) <= now,
  )

  const bookingsMap = pastRecent.length
    ? await bookingsApi
        .bySchedules(pastRecent.map((s) => s.id), session.token)
        .catch(() => ({} as Record<string, Booking[]>))
    : {}

  const pendingByScheduleId: Record<string, number> = {}
  for (const s of pastRecent) {
    const bookings = bookingsMap[s.id] ?? []
    pendingByScheduleId[s.id] = bookings.filter(
      (b) => b.status === 'confirmed' && b.attendanceStatus === 'pending',
    ).length
  }

  return (
    <SessionsClient
      schedules={mySchedules}
      classes={classes}
      token={session.token}
      pendingByScheduleId={pendingByScheduleId}
      serverNowMs={Date.now()}
    />
  )
}
