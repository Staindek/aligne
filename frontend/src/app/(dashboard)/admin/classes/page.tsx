import { getSession } from '@/lib/session'
import { classesApi } from '@/lib/api'
import ClassesClient from './classes-client'

export default async function ClassesPage() {
  const session = (await getSession())!
  const classes = await classesApi.list(session.token).catch(() => [])
  return <ClassesClient classes={classes} token={session.token} />
}
