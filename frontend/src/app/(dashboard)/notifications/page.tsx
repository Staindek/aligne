import { getSession } from '@/lib/session'
import { notificationsApi } from '@/lib/api'
import NotificationsClient from './notifications-client'

export default async function NotificationsPage() {
  const session = (await getSession())!
  const items = await notificationsApi.list(session.token).catch(() => [])
  return <NotificationsClient items={items} token={session.token} />
}
