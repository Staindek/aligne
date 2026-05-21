import { getSession } from '@/lib/session'
import { reportsApi } from '@/lib/api'
import ReportsClient from './reports-client'

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const session = (await getSession())!
  const params = await searchParams
  const month = params.month ?? new Date().toISOString().substring(0, 7)
  const data = await reportsApi.summary(session.token, month).catch(() => null)
  return <ReportsClient initial={data} month={month} token={session.token} />
}
