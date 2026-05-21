import { getSession } from '@/lib/session'
import { packsApi } from '@/lib/api'
import PacksClient from './packs-client'

export default async function PacksPage() {
  const session = (await getSession())!
  const packs = await packsApi.list(session.token, true).catch(() => [])
  return <PacksClient packs={packs} token={session.token} />
}
