import { getSession } from '@/lib/session'
import { schedulesApi, bookingsApi, paymentsApi, recurringBookingsApi, authApi } from '@/lib/api'
import type { MonthPaymentSummary, ClassLevel } from '@/lib/definitions'
import ClassesClient from './classes-client'

export default async function StudentClassesPage() {
  const session = (await getSession())!
  const [schedules, classCount, summary, myBookings, myRecurring, me] = await Promise.all([
    schedulesApi.list(session.token).catch(() => []),
    bookingsApi.myClassCount(session.token).catch(() => ({ count: 0, limit: 0 as number | null })),
    paymentsApi.currentMonth(session.token).catch((): MonthPaymentSummary => ({
      month: new Date().toISOString().substring(0, 7),
      effectivePack: null,
      classLimit: 0,
      totalPaid: 0,
      userCredit: 0,
      userClassCredit: 0,
      userClassCreditMonth: null,
      payments: [],
    })),
    bookingsApi.myBookings(session.token).catch(() => []),
    recurringBookingsApi.myActive(session.token).catch(() => []),
    authApi.me(session.token).catch(() => null),
  ])
  return (
    <ClassesClient
      schedules={schedules}
      token={session.token}
      classCount={classCount}
      summary={summary}
      myBookings={myBookings}
      myRecurring={myRecurring}
      userLevel={(me?.level ?? 'abierto') as ClassLevel}
      serverNowMs={Date.now()}
    />
  )
}
