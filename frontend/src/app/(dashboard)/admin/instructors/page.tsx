import { getSession } from '@/lib/session'
import { instructorsApi } from '@/lib/api'
import InstructorsClient from './instructors-client'

export default async function InstructorsPage() {
  const session = (await getSession())!
  const instructors = await instructorsApi.list(session.token).catch(() => [])
  return <InstructorsClient instructors={instructors} token={session.token} />
}
