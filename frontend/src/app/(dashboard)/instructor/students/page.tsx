import { getSession } from '@/lib/session'
import { usersApi, bookingsApi } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users } from 'lucide-react'
import { LevelMedal, LEVEL_LABEL } from '@/components/level-medal'
import type { ClassLevel } from '@/lib/definitions'

async function StudentRow({
  userId,
  firstName,
  lastName,
  email,
  level,
  token,
}: {
  userId: string
  firstName: string
  lastName: string
  email: string
  level: ClassLevel
  token: string
}) {
  const [data, noShows] = await Promise.all([
    bookingsApi
      .userClassCount(userId, token)
      .catch(() => ({ count: 0, limit: 0 as number | null })),
    bookingsApi.userNoShowCount(userId, token).catch(() => ({ count: 0 })),
  ])
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent shrink-0">
          <Users className="h-5 w-5 text-accent-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">{firstName} {lastName}</p>
            <span
              className="inline-flex items-center gap-1 text-[11px] px-1.5 h-5 rounded-full bg-secondary capitalize shrink-0"
              title={`Nivel ${LEVEL_LABEL[level]}`}
            >
              <LevelMedal level={level} size="sm" />
              {LEVEL_LABEL[level]}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{email}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {noShows.count > 0 && (
            <Badge variant={noShows.count >= 3 ? 'destructive' : 'secondary'}>
              {noShows.count} falta{noShows.count === 1 ? '' : 's'}
            </Badge>
          )}
          {data.limit === null ? (
            <span className="text-sm text-muted-foreground">
              {data.count} clases · libre
            </span>
          ) : data.limit === 0 ? (
            <span className="text-sm text-muted-foreground">sin pack</span>
          ) : (
            <div className="flex items-center gap-1.5">
              {Array.from({ length: data.limit }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full ${
                    i < data.count ? 'bg-primary' : 'bg-muted border border-border'
                  }`}
                />
              ))}
              <span className="text-sm font-medium ml-1">
                {data.count}/{data.limit}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default async function InstructorStudentsPage() {
  const session = (await getSession())!
  const users = await usersApi.list(session.token).catch(() => [])
  const students = users.filter((u) => u.role === 'student' && u.isActive)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-medium tracking-tight text-foreground">Alumnxs</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Clases usadas este mes</p>
      </div>

      {students.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No hay alumnxs activxs</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {students.map((u) => (
            <StudentRow
              key={u.id}
              userId={u.id}
              firstName={u.firstName}
              lastName={u.lastName}
              email={u.email}
              level={u.level}
              token={session.token}
            />
          ))}
        </div>
      )}
    </div>
  )
}
