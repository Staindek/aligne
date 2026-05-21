import { getSession } from '@/lib/session'
import { invitationsApi } from '@/lib/api'
import InvitationsClient from './invitations-client'

export default async function InvitationsPage() {
  const session = (await getSession())!
  const items = await invitationsApi.list(session.token).catch(() => [])
  return <InvitationsClient items={items} token={session.token} />
}
