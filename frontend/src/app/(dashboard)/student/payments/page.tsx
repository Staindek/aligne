import { getSession } from '@/lib/session'
import { paymentsApi, packsApi, bookingsApi } from '@/lib/api'
import type { MonthPaymentSummary } from '@/lib/definitions'
import PaymentsClient from './payments-client'

export default async function StudentPaymentsPage() {
  const session = (await getSession())!
  const [payments, summary, packs, classCount] = await Promise.all([
    paymentsApi.myPayments(session.token).catch(() => []),
    paymentsApi
      .currentMonth(session.token)
      .catch((): MonthPaymentSummary => ({
        month: new Date().toISOString().substring(0, 7),
        effectivePack: null,
        classLimit: 0,
        totalPaid: 0,
        userCredit: 0,
        userClassCredit: 0,
        userClassCreditMonth: null,
        payments: [],
      })),
    packsApi.list(session.token).catch(() => []),
    bookingsApi.myClassCount(session.token).catch(() => ({ count: 0, limit: 0 })),
  ])

  return (
    <PaymentsClient
      payments={payments}
      summary={summary}
      packs={packs}
      classCount={classCount}
      token={session.token}
      serverNowMs={Date.now()}
    />
  )
}
