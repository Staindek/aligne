import Link from 'next/link'
import { getSession } from '@/lib/session'
import { schedulesApi, bookingsApi } from '@/lib/api'
import type { Booking } from '@/lib/definitions'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CalendarClock,
  ClipboardCheck,
  Users,
  TrendingUp,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfWeek(d: Date): Date {
  const r = new Date(d)
  const dow = r.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  r.setDate(r.getDate() + diff)
  r.setHours(0, 0, 0, 0)
  return r
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function toISO(d: Date): string {
  return `${d.toISOString().slice(0, 10)}`
}

function formatTime(t: string): string {
  return t.substring(0, 5)
}

function formatDayShort(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function scheduleStart(date: string, startTime: string): number {
  return new Date(`${date}T${formatTime(startTime)}:00`).getTime()
}

export default async function InstructorHome() {
  const session = (await getSession())!
  const today = todayISO()
  const month = today.slice(0, 7)
  const monthStart = `${month}-01`
  const now = Date.now()

  const allSchedules = await schedulesApi.list(session.token).catch(() => [])
  const mySchedules = allSchedules.filter(
    (s) => s.instructor.email === session.user.email,
  )

  const monthSchedules = mySchedules.filter((s) => s.date >= monthStart && s.date <= `${month}-31`)
  const pastMonthSchedules = monthSchedules.filter((s) => scheduleStart(s.date, s.startTime) <= now)

  const bookingsMap = pastMonthSchedules.length
    ? await bookingsApi
        .bySchedules(pastMonthSchedules.map((s) => s.id), session.token)
        .catch(() => ({} as Record<string, Booking[]>))
    : {}

  let pendingAttendance = 0
  let presentCount = 0
  let absentCount = 0
  const distinctStudents = new Set<string>()
  const pendingByScheduleId: Record<string, number> = {}

  for (const s of pastMonthSchedules) {
    const bks = bookingsMap[s.id] ?? []
    const confirmedBks = bks.filter((b) => b.status === 'confirmed')
    const pending = confirmedBks.filter((b) => b.attendanceStatus === 'pending').length
    pendingByScheduleId[s.id] = pending
    pendingAttendance += pending
    for (const b of confirmedBks) {
      distinctStudents.add(b.user.id)
      if (b.attendanceStatus === 'present') presentCount++
      else if (b.attendanceStatus === 'absent') absentCount++
    }
  }

  const attendanceRate =
    presentCount + absentCount > 0
      ? Math.round((presentCount / (presentCount + absentCount)) * 100)
      : null

  const todaySchedules = mySchedules
    .filter((s) => s.date === today)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  const weekStart = toISO(startOfWeek(new Date()))
  const weekEnd = toISO(addDays(startOfWeek(new Date()), 6))
  const upcomingThisWeek = mySchedules
    .filter(
      (s) =>
        s.date > today &&
        s.date >= weekStart &&
        s.date < weekEnd &&
        !s.isCancelled,
    )
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
    .slice(0, 6)

  const pendingSessions = pastMonthSchedules
    .filter((s) => (pendingByScheduleId[s.id] ?? 0) > 0)
    .sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime))
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-4xl font-medium tracking-tight text-foreground">
            Hola{session.user.firstName ? `, ${session.user.firstName}` : ''}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Tu día en el estudio</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" render={<Link href="/instructor/sessions" />}>
            <CalendarClock className="h-4 w-4" />
            Mis sesiones
          </Button>
          <Button variant="outline" size="sm" render={<Link href="/instructor/students" />}>
            <Users className="h-4 w-4" />
            Mis alumnxs
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          href="/instructor/sessions"
          icon={CalendarClock}
          label="Clases hoy"
          value={todaySchedules.length}
          hint={
            todaySchedules.length > 0
              ? `${todaySchedules.reduce((a, s) => a + s.enrolledCount, 0)}/${todaySchedules.reduce((a, s) => a + s.maxCapacity, 0)} reservas`
              : 'Sin clases'
          }
        />
        <KpiCard
          href="/instructor/sessions"
          icon={ClipboardCheck}
          label="Asistencia pendiente"
          value={pendingAttendance}
          hint={pendingAttendance === 0 ? 'Todo marcado' : 'Por marcar'}
          tone={pendingAttendance > 0 ? 'warning' : 'default'}
        />
        <KpiCard
          href="/instructor/sessions"
          icon={CalendarClock}
          label="Clases del mes"
          value={pastMonthSchedules.length}
          hint={`${monthSchedules.length} agendadas`}
        />
        <KpiCard
          href="/instructor/students"
          icon={TrendingUp}
          label="Tasa asistencia"
          value={attendanceRate !== null ? `${attendanceRate}%` : '—'}
          hint={
            attendanceRate !== null
              ? `${distinctStudents.size} alumnxs este mes`
              : 'Sin datos aún'
          }
          tone={attendanceRate !== null && attendanceRate >= 80 ? 'success' : 'default'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-medium">Clases de hoy</h2>
              </div>
              <Button variant="ghost" size="sm" render={<Link href="/instructor/sessions" />}>
                Ver semana
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {todaySchedules.length === 0 ? (
              <EmptyRow icon={CheckCircle2} text="No tenés clases hoy" />
            ) : (
              <ul className="divide-y divide-border">
                {todaySchedules.map((s) => {
                  const occ = s.maxCapacity > 0 ? s.enrolledCount / s.maxCapacity : 0
                  const isPast = scheduleStart(s.date, s.startTime) <= now
                  return (
                    <li key={s.id} className="flex items-center gap-3 py-2.5">
                      <div className="w-16 shrink-0">
                        <p className="text-sm font-semibold tabular-nums">{formatTime(s.startTime)}</p>
                        <p className="text-[11px] text-muted-foreground tabular-nums">{formatTime(s.endTime)}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.pilatesClass.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {isPast ? 'Ya empezó / pasó' : 'Próxima'}
                        </p>
                      </div>
                      <Badge
                        variant={occ >= 0.8 ? 'default' : occ <= 0.3 ? 'destructive' : 'secondary'}
                        className="tabular-nums"
                      >
                        <Users className="h-3 w-3 mr-1" />
                        {s.enrolledCount}/{s.maxCapacity}
                      </Badge>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-medium">Para marcar asistencia</h2>
              {pendingSessions.length > 0 && (
                <Badge variant="secondary" className="ml-auto tabular-nums">
                  {pendingSessions.length}
                </Badge>
              )}
            </div>
            {pendingSessions.length === 0 ? (
              <EmptyRow icon={CheckCircle2} text="Todo al día" />
            ) : (
              <ul className="space-y-1.5">
                {pendingSessions.map((s) => (
                  <li key={s.id}>
                    <Link
                      href="/instructor/sessions"
                      className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-md hover:bg-muted transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{s.pilatesClass.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {formatDayShort(s.date)} · {formatTime(s.startTime)}
                        </p>
                      </div>
                      <Badge variant="secondary" className="tabular-nums">
                        {pendingByScheduleId[s.id]}
                      </Badge>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-medium">Próximas esta semana</h2>
            </div>
            <Button variant="ghost" size="sm" render={<Link href="/instructor/sessions" />}>
              Ver todas
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {upcomingThisWeek.length === 0 ? (
            <EmptyRow icon={CheckCircle2} text="No tenés más clases esta semana" />
          ) : (
            <ul className="divide-y divide-border">
              {upcomingThisWeek.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5">
                  <div className="w-28 shrink-0 capitalize">
                    <p className="text-sm font-medium tabular-nums">{formatDayShort(s.date)}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      {formatTime(s.startTime)}
                    </p>
                  </div>
                  <p className="flex-1 text-sm truncate">{s.pilatesClass.name}</p>
                  <Badge variant="secondary" className="tabular-nums">
                    <Users className="h-3 w-3 mr-1" />
                    {s.enrolledCount}/{s.maxCapacity}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function KpiCard({
  href,
  icon: Icon,
  label,
  value,
  hint,
  tone = 'default',
}: {
  href: string
  icon: React.ElementType
  label: string
  value: string | number
  hint?: string
  tone?: 'default' | 'success' | 'warning'
}) {
  const toneClass =
    tone === 'success'
      ? 'text-emerald-700 bg-emerald-500/10'
      : tone === 'warning'
        ? 'text-amber-700 bg-amber-500/10'
        : 'text-primary bg-secondary'
  return (
    <Link href={href} className="group">
      <Card className="transition-colors group-hover:border-foreground/20">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${toneClass}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-eyebrow truncate">{label}</p>
              <p className="text-2xl font-semibold mt-0.5 tabular-nums">{value}</p>
              {hint && <p className="text-xs text-muted-foreground mt-0.5 truncate">{hint}</p>}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function EmptyRow({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
      <Icon className="h-4 w-4" />
      <span>{text}</span>
    </div>
  )
}
