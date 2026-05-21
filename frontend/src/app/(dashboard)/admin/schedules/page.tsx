import { getSession } from '@/lib/session'
import { schedulesApi, classesApi, instructorsApi } from '@/lib/api'
import SchedulesClient from './schedules-client'

export default async function SchedulesPage() {
  const session = (await getSession())!
  const [schedules, classes, instructors] = await Promise.all([
    schedulesApi.list(session.token).catch(() => []),
    classesApi.list(session.token).catch(() => []),
    instructorsApi.list(session.token).catch(() => []),
  ])
  return (
    <SchedulesClient
      schedules={schedules}
      classes={classes}
      instructors={instructors}
      token={session.token}
      serverNowMs={Date.now()}
    />
  )
}
