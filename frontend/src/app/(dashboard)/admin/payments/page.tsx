import { getSession } from '@/lib/session'
import { paymentsApi, packsApi } from '@/lib/api'
import AdminPaymentsClient from './admin-payments-client'

export default async function AdminPaymentsPage() {
  const session = (await getSession())!
  const [payments, packs] = await Promise.all([
    paymentsApi.adminList(session.token).catch(() => []),
    packsApi.list(session.token).catch(() => []),
  ])
  return <AdminPaymentsClient payments={payments} packs={packs} token={session.token} />
}
