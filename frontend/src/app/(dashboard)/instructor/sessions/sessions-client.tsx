'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Users, AlertCircle } from 'lucide-react'
import type { Schedule, PilatesClass } from '@/lib/definitions'
import AttendanceDialog from '@/components/attendance-dialog'
import EditSessionButton from './edit-session-button'
import {
  ScheduleViewToggle,
  usePersistedScheduleView,
} from '@/components/schedule-view-toggle'

function formatTime(t: string) { return t.substring(0, 5) }

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
  return d.toISOString().slice(0, 10)
}

function formatRange(start: Date, end: Date): string {
  const s = start.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
  const e = end.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
  return `${s} — ${e}`
}

function formatDayLong(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('es-AR', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

const WEEK_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export default function SessionsClient({
  schedules,
  classes,
  token,
  pendingByScheduleId,
  serverNowMs,
}: {
  schedules: Schedule[]
  classes: PilatesClass[]
  token: string
  pendingByScheduleId: Record<string, number>
  serverNowMs: number
}) {
  const [nowMs, setNowMs] = useState(serverNowMs)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(serverNowMs)))
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date(serverNowMs))
  const { view, setView } = usePersistedScheduleView('schedule-view:instructor', 'day')
  useEffect(() => {
    setNowMs(Date.now())
    setSelectedDate(new Date())
    setWeekStart(startOfWeek(new Date()))
  }, [])
  const weekEnd = addDays(weekStart, 5)
  const weekStartISO = toISO(weekStart)
  const weekEndISO = toISO(addDays(weekStart, 6))
  const today = toISO(new Date(nowMs))
  const selectedIso = toISO(selectedDate)
  const isSelectedToday = selectedIso === today
  const daySchedules = schedules
    .filter((s) => s.date === selectedIso)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  function renderCard(s: Schedule) {
    return (
      <Card key={s.id}>
        <CardContent className="py-3 px-3 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold tabular-nums">{formatTime(s.startTime)}</p>
            <Badge
              variant={s.enrolledCount >= s.maxCapacity ? 'destructive' : 'secondary'}
              className="text-[10px] px-1.5"
            >
              {s.enrolledCount}/{s.maxCapacity}
            </Badge>
          </div>
          <p className="text-sm leading-tight">{s.pilatesClass.name}</p>
          <div className="flex items-center justify-end gap-0.5 -mr-1">
            <AttendanceDialog schedule={s} token={token} />
            <EditSessionButton schedule={s} classes={classes} token={token} />
          </div>
        </CardContent>
      </Card>
    )
  }

  function renderDayCard(s: Schedule) {
    const isFull = s.enrolledCount >= s.maxCapacity
    return (
      <Card key={s.id}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <p className="text-2xl font-semibold tabular-nums leading-none w-[58px] shrink-0">
              {formatTime(s.startTime)}
            </p>
            <div className="flex-1 min-w-0">
              <p className="text-base font-medium truncate">{s.pilatesClass.name}</p>
              <p className="text-sm text-muted-foreground truncate">
                {s.enrolledCount} {s.enrolledCount === 1 ? 'alumnx anotadx' : 'alumnxs anotadxs'}
              </p>
            </div>
            <Badge
              variant={isFull ? 'destructive' : 'secondary'}
              className="text-xs tabular-nums shrink-0"
            >
              {s.enrolledCount}/{s.maxCapacity}
            </Badge>
          </div>
          <div className="flex items-center justify-end gap-1 pt-2 border-t border-border/60 -mr-1">
            <AttendanceDialog schedule={s} token={token} />
            <EditSessionButton schedule={s} classes={classes} token={token} />
          </div>
        </CardContent>
      </Card>
    )
  }

  const actionables = schedules
    .filter((s) => (pendingByScheduleId[s.id] ?? 0) > 0)
    .sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime))

  const weekSchedules = schedules.filter(
    (s) => s.date >= weekStartISO && s.date < weekEndISO,
  )
  const sundayCount = schedules.filter(
    (s) => s.date === toISO(addDays(weekStart, 6)),
  ).length

  const byDay: Record<string, Schedule[]> = {}
  for (let i = 0; i < 6; i++) byDay[toISO(addDays(weekStart, i))] = []
  for (const s of weekSchedules) if (byDay[s.date]) byDay[s.date].push(s)
  for (const key in byDay)
    byDay[key].sort((a, b) => a.startTime.localeCompare(b.startTime))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-medium tracking-tight text-foreground">Mis sesiones</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Marcá asistencia al final de cada clase</p>
      </div>

      {actionables.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Para marcar asistencia ({actionables.length})
            </h2>
          </div>
          <Card>
            <CardContent className="py-2 divide-y divide-border/60">
              {actionables.map((s) => {
                const pending = pendingByScheduleId[s.id] ?? 0
                return (
                  <div key={s.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight truncate">
                        {s.pilatesClass.name}
                        <span className="ml-2 text-xs text-muted-foreground font-normal capitalize">
                          {formatDayLong(s.date)} · {formatTime(s.startTime)}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {pending} {pending === 1 ? 'alumnx pendiente' : 'alumnxs pendientes'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant="secondary" className="text-[10px] px-1.5">
                        <Users className="h-3 w-3 mr-1" />
                        {s.enrolledCount}/{s.maxCapacity}
                      </Badge>
                      <AttendanceDialog schedule={s} token={token} />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </section>
      )}

      <section className="space-y-3">
        {view === 'day' ? (
          <div className="max-w-xl mx-auto w-full space-y-4">
            <div className="flex items-center justify-between gap-2">
              <ScheduleViewToggle view={view} onChange={setView} />
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setSelectedDate(addDays(selectedDate, -1))}
                  aria-label="Día anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {!isSelectedToday && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedDate(new Date())}
                  >
                    Hoy
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                  aria-label="Día siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="text-center">
              <p className={`text-xs font-medium uppercase tracking-wide capitalize ${isSelectedToday ? 'text-today-ink' : 'text-muted-foreground'}`}>
                {selectedDate.toLocaleDateString('es-AR', { weekday: 'long' })}
              </p>
              <div className="flex items-center justify-center gap-2 mt-0.5">
                <p className={`font-display text-2xl font-medium capitalize tracking-tight ${isSelectedToday ? 'text-today-ink' : ''}`}>
                  {selectedDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
                </p>
                {isSelectedToday && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-season text-primary-foreground">
                    hoy
                  </span>
                )}
              </div>
            </div>

            {daySchedules.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  Sin clases este día
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {daySchedules.map((s) => renderDayCard(s))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setWeekStart(addDays(weekStart, -7))}
                  aria-label="Semana anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setWeekStart(startOfWeek(new Date()))}
                >
                  Esta semana
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setWeekStart(addDays(weekStart, 7))}
                  aria-label="Semana siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground capitalize tabular-nums">
                  {formatRange(weekStart, weekEnd)}
                </p>
                <ScheduleViewToggle view={view} onChange={setView} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              {WEEK_DAYS.map((dayLabel, i) => {
                const dateISO = toISO(addDays(weekStart, i))
                const dayDate = addDays(weekStart, i)
                const dayClasses = byDay[dateISO] ?? []
                const isToday = dateISO === today
                return (
                  <div
                    key={dateISO}
                    className={
                      isToday
                        ? 'space-y-2 rounded-xl bg-today-bg/70 ring-1 ring-season/40 p-2'
                        : 'space-y-2'
                    }
                  >
                    <div
                      className={
                        isToday
                          ? 'flex items-center justify-between pb-1 border-b-2 border-season'
                          : 'flex items-center justify-between pb-1 border-b border-border'
                      }
                    >
                      <div>
                        <p
                          className={
                            isToday
                              ? 'text-xs font-medium uppercase tracking-wide text-today-ink'
                              : 'text-xs font-medium uppercase tracking-wide text-muted-foreground'
                          }
                        >
                          {dayLabel}
                        </p>
                        <p
                          className={
                            isToday
                              ? 'text-sm font-semibold tabular-nums text-today-ink'
                              : 'text-sm font-semibold tabular-nums'
                          }
                        >
                          {dayDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      {isToday && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-season text-primary-foreground">
                          hoy
                        </span>
                      )}
                    </div>
                    {dayClasses.length === 0 ? (
                      <p className="text-xs text-muted-foreground/60 py-2">Sin clases</p>
                    ) : (
                      <div className="space-y-2">
                        {dayClasses.map((s) => renderCard(s))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {sundayCount > 0 && (
              <p className="text-xs text-muted-foreground">
                Hay {sundayCount} {sundayCount === 1 ? 'clase' : 'clases'} el domingo (no se muestran en la grilla).
              </p>
            )}
          </>
        )}
      </section>
    </div>
  )
}
