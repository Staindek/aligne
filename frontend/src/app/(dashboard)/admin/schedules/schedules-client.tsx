'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { schedulesApi } from '@/lib/api'
import type { Schedule, PilatesClass, Instructor } from '@/lib/definitions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Trash2, Plus, Pencil, CalendarPlus, ChevronLeft, ChevronRight, CalendarClock } from 'lucide-react'
import AttendanceDialog from '@/components/attendance-dialog'
import BulkScheduleForm from './bulk-form'
import {
  ScheduleViewToggle,
  usePersistedScheduleView,
} from '@/components/schedule-view-toggle'

function formatTime(t: string) { return t.substring(0, 5) }
function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-AR', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

const DAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
]

function nextDateForDow(dow: number): string {
  const today = new Date()
  const daysAhead = (dow - today.getDay() + 7) % 7
  const next = new Date(today)
  next.setDate(today.getDate() + daysAhead)
  return next.toISOString().slice(0, 10)
}

function dowFromDate(d: string): number {
  return new Date(d + 'T00:00:00').getDay()
}

function startOfWeek(d: Date): Date {
  const result = new Date(d)
  const dow = result.getDay()
  const diff = dow === 0 ? -6 : 1 - dow // a Lunes
  result.setDate(result.getDate() + diff)
  result.setHours(0, 0, 0, 0)
  return result
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

const WEEK_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function formatRange(start: Date, end: Date): string {
  const s = start.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
  const e = end.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
  return `${s} — ${e}`
}

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number)
  const total = h * 60 + m + minutes
  const nh = Math.floor(total / 60) % 24
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}

function ScheduleForm({
  token,
  classes,
  instructors,
  onDone,
}: {
  token: string
  classes: PilatesClass[]
  instructors: Instructor[]
  onDone: () => void
}) {
  const [pending, setPending] = useState(false)
  const [classId, setClassId] = useState(classes[0]?.id ?? '')
  const [startTime, setStartTime] = useState('09:00')
  const [dow, setDow] = useState<number>(new Date().getDay() || 1)

  const selectedClass = classes.find((c) => c.id === classId)
  const endTime = selectedClass ? addMinutes(startTime, selectedClass.durationMinutes) : ''
  const date = nextDateForDow(dow)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!classId) return toast.error('Elegí una modalidad')
    if (classes.length === 0) return toast.error('Creá una modalidad primero')
    if (instructors.length === 0) return toast.error('Creá una instructora primero')

    setPending(true)
    const fd = new FormData(e.currentTarget)
    const data = {
      pilatesClassId: classId,
      instructorId: fd.get('instructorId'),
      date,
      startTime,
      endTime,
    }
    try {
      await schedulesApi.create(data, token)
      toast.success('Clase agendada')
      onDone()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setPending(false)
    }
  }

  if (classes.length === 0 || instructors.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        {classes.length === 0 ? 'Creá al menos una modalidad antes de agendar clases.' : 'Creá al menos una instructora antes de agendar clases.'}
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <Label>Modalidad</Label>
        <select
          name="pilatesClassId"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
          required
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.durationMinutes} min · máx {c.maxCapacity})
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label>Instructora</Label>
        <select
          name="instructorId"
          className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
          required
        >
          {instructors.map((i) => (
            <option key={i.id} value={i.id}>
              {i.firstName} {i.lastName}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Día</Label>
          <select
            value={dow}
            onChange={(e) => setDow(Number(e.target.value))}
            className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
            required
          >
            {DAY_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Hora de inicio</Label>
          <Input
            name="startTime"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Se agendará el <span className="font-medium text-foreground capitalize">{formatDate(date)}</span>
        {endTime && <> · termina <span className="font-medium text-foreground">{endTime}</span> ({selectedClass?.durationMinutes} min)</>}
      </p>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Guardando…' : 'Agendar clase'}
      </Button>
    </form>
  )
}

function EditScheduleForm({
  schedule,
  token,
  classes,
  instructors,
  onDone,
}: {
  schedule: Schedule
  token: string
  classes: PilatesClass[]
  instructors: Instructor[]
  onDone: () => void
}) {
  const [pending, setPending] = useState(false)
  const [classId, setClassId] = useState(schedule.pilatesClass.id)
  const [instructorId, setInstructorId] = useState(schedule.instructor.id)
  const [dow, setDow] = useState<number>(dowFromDate(schedule.date))
  const [keepOriginalDate, setKeepOriginalDate] = useState(true)
  const [startTime, setStartTime] = useState(schedule.startTime.substring(0, 5))
  const date = keepOriginalDate ? schedule.date : nextDateForDow(dow)

  const selectedClass = classes.find((c) => c.id === classId)
  const endTime = selectedClass ? addMinutes(startTime, selectedClass.durationMinutes) : ''

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    try {
      await schedulesApi.update(
        schedule.id,
        { pilatesClassId: classId, instructorId, date, startTime, endTime },
        token,
      )
      toast.success('Clase actualizada')
      onDone()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <Label>Modalidad</Label>
        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
          required
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.durationMinutes} min · máx {c.maxCapacity})
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label>Instructora</Label>
        <select
          value={instructorId}
          onChange={(e) => setInstructorId(e.target.value)}
          className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
          required
        >
          {instructors.map((i) => (
            <option key={i.id} value={i.id}>
              {i.firstName} {i.lastName}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Día</Label>
          <select
            value={dow}
            onChange={(e) => { setDow(Number(e.target.value)); setKeepOriginalDate(false) }}
            className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
            required
          >
            {DAY_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Hora de inicio</Label>
          <Input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {keepOriginalDate ? 'Fecha actual: ' : 'Se moverá a: '}
        <span className="font-medium text-foreground capitalize">{formatDate(date)}</span>
        {endTime && <> · termina <span className="font-medium text-foreground">{endTime}</span> ({selectedClass?.durationMinutes} min)</>}
      </p>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Guardando…' : 'Guardar cambios'}
      </Button>
    </form>
  )
}

export default function SchedulesClient({
  schedules,
  classes,
  instructors,
  token,
  serverNowMs,
}: {
  schedules: Schedule[]
  classes: PilatesClass[]
  instructors: Instructor[]
  token: string
  serverNowMs: number
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [editing, setEditing] = useState<Schedule | null>(null)
  const [nowMs, setNowMs] = useState(serverNowMs)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(serverNowMs)))
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date(serverNowMs))
  const { view, setView } = usePersistedScheduleView('schedule-view:admin', 'week')
  useEffect(() => {
    setNowMs(Date.now())
    setSelectedDate(new Date())
    setWeekStart(startOfWeek(new Date()))
  }, [])

  function nextMonthLabel(): string {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() + 1)
    return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  }

  async function handleGenerateNextMonth() {
    const label = nextMonthLabel()
    if (!confirm(`¿Generar las clases de ${label} replicando la grilla del mes anterior?`)) return
    setGenerating(true)
    try {
      const res = await schedulesApi.generateMonth(token)
      const c = res.created.length
      const s = res.skipped.length
      if (c === 0 && s === 0) {
        toast.info('No hay grilla del mes anterior para replicar')
      } else {
        toast.success(
          `${c} ${c === 1 ? 'clase creada' : 'clases creadas'}` +
            (s > 0 ? ` · ${s} salteada${s === 1 ? '' : 's'}` : ''),
        )
      }
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al generar')
    } finally {
      setGenerating(false)
    }
  }

  const weekEnd = addDays(weekStart, 5) // Sábado
  const weekStartISO = toISO(weekStart)
  const weekEndISO = toISO(addDays(weekStart, 6))

  const weekSchedules = schedules.filter(
    (s) => s.date >= weekStartISO && s.date < weekEndISO,
  )
  const sundayCount = schedules.filter(
    (s) => s.date === toISO(addDays(weekStart, 6)),
  ).length

  const byDay: Record<string, Schedule[]> = {}
  for (let i = 0; i < 6; i++) {
    byDay[toISO(addDays(weekStart, i))] = []
  }
  for (const s of weekSchedules) {
    if (byDay[s.date]) byDay[s.date].push(s)
  }
  for (const key in byDay) {
    byDay[key].sort((a, b) => a.startTime.localeCompare(b.startTime))
  }

  const today = toISO(new Date(nowMs))
  const selectedIso = toISO(selectedDate)
  const isSelectedToday = selectedIso === today
  const daySchedules = schedules
    .filter((s) => s.date === selectedIso)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  function renderCard(s: Schedule) {
    return (
      <Card key={s.id} className="group">
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
          <p className="text-xs text-muted-foreground truncate">{s.instructor.firstName} {s.instructor.lastName}</p>
          <div className="flex items-center justify-end gap-0.5 -mr-1">
            <AttendanceDialog schedule={s} token={token} />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setEditing(s)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => handleCancel(s.id)}
              disabled={loading === s.id}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
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
                {s.instructor.firstName} {s.instructor.lastName}
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
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setEditing(s)}
              aria-label="Editar"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => handleCancel(s.id)}
              disabled={loading === s.id}
              aria-label="Cancelar"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  async function handleCancel(id: string) {
    if (!confirm('¿Cancelar esta clase?')) return
    setLoading(id)
    try {
      await schedulesApi.cancel(id, token)
      toast.success('Clase cancelada')
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al cancelar')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl font-medium tracking-tight text-foreground">Clases</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Clases agendadas en el calendario</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleGenerateNextMonth}
            disabled={generating}
          >
            <CalendarClock className="h-4 w-4 mr-1" />
            {generating ? 'Generando…' : 'Generar próximo mes'}
          </Button>
          <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
            <DialogTrigger render={<Button size="sm" variant="outline"><CalendarPlus className="h-4 w-4 mr-1" />Agendar varias</Button>} />
            <DialogContent>
              <DialogHeader><DialogTitle>Agendar varias clases</DialogTitle></DialogHeader>
              <BulkScheduleForm
                classes={classes}
                instructors={instructors}
                token={token}
                onDone={() => { setBulkOpen(false); router.refresh() }}
              />
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button size="sm"><Plus className="h-4 w-4 mr-1" />Nueva clase</Button>} />
            <DialogContent>
              <DialogHeader><DialogTitle>Nueva clase</DialogTitle></DialogHeader>
              <ScheduleForm
                token={token}
                classes={classes}
                instructors={instructors}
                onDone={() => { setOpen(false); router.refresh() }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

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
              Hay {sundayCount} {sundayCount === 1 ? 'clase agendada' : 'clases agendadas'} el domingo (no se muestran en la grilla).
            </p>
          )}
        </>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar clase</DialogTitle></DialogHeader>
          {editing && (
            <EditScheduleForm
              schedule={editing}
              token={token}
              classes={classes}
              instructors={instructors}
              onDone={() => { setEditing(null); router.refresh() }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
