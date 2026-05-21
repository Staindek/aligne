import { getSession } from '@/lib/session'
import { usersApi, bookingsApi } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users } from 'lucide-react'
import LevelSelect from './level-select'
import CreateUserButton from './create-user-button'
import { LevelMedal } from '@/components/level-medal'

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', instructor: 'Instructora', student: 'Alumnx' }
const ROLE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  admin: 'default', instructor: 'secondary', student: 'outline',
}

async function StudentClassCount({ userId, token }: { userId: string; token: string }) {
  const data = await bookingsApi
    .userClassCount(userId, token)
    .catch(() => ({ count: 0, limit: 0 as number | null }))

  if (data.limit === null) {
    return (
      <span
        className="text-xs text-muted-foreground"
        title={`${data.count} clases reservadas este mes (uso libre)`}
      >
        {data.count} · libre
      </span>
    )
  }
  if (data.limit === 0) {
    return (
      <span className="text-xs text-muted-foreground" title="Sin pack este mes">
        sin pack
      </span>
    )
  }
  return (
    <div
      className="flex items-center gap-1"
      title={`${data.count} de ${data.limit} clases usadas este mes`}
    >
      {Array.from({ length: data.limit }).map((_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full ${
            i < data.count ? 'bg-primary' : 'bg-muted border border-border'
          }`}
        />
      ))}
      <span className="text-xs text-muted-foreground ml-1">
        {data.count}/{data.limit}
      </span>
    </div>
  )
}

async function StudentNoShows({ userId, token }: { userId: string; token: string }) {
  const data = await bookingsApi.userNoShowCount(userId, token).catch(() => ({ count: 0 }))
  if (data.count === 0) return null
  const danger = data.count >= 3
  return (
    <Badge
      variant={danger ? 'destructive' : 'secondary'}
      title={`${data.count} falta${data.count === 1 ? '' : 's'} este mes`}
    >
      {data.count} falta{data.count === 1 ? '' : 's'}
    </Badge>
  )
}

export default async function UsersPage() {
  const session = (await getSession())!
  const users = await usersApi.list(session.token).catch(() => [])

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-4xl font-medium tracking-tight text-foreground">Usuarixs</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Alumnxs y equipo del estudio</p>
        </div>
        <CreateUserButton token={session.token} />
      </div>
      <div className="space-y-3">
        {users.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No hay usuarixs</CardContent></Card>
        ) : users.map((u) => (
          <Card key={u.id}>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent shrink-0">
                <Users className="h-5 w-5 text-accent-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{u.firstName} {u.lastName}</p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {u.role === 'student' && (
                  <>
                    <LevelMedal level={u.level} size="md" />
                    <LevelSelect userId={u.id} current={u.level} token={session.token} />
                    <StudentNoShows userId={u.id} token={session.token} />
                    <StudentClassCount userId={u.id} token={session.token} />
                  </>
                )}
                <Badge variant={ROLE_VARIANT[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                {!u.isActive && <Badge variant="destructive">Inactiva</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
