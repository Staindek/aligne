'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { bookingsApi, recurringBookingsApi } from '@/lib/api'
import type {
  Schedule,
  Booking,
  RecurringBooking,
  MonthPaymentSummary,
  ClassLevel,
} from '@/lib/definitions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { LevelMedal, LEVEL_LABEL, LEVEL_STRIPE_BG } from '@/components/level-medal'
import {
  ScheduleViewToggle,
  usePersistedScheduleView,
} from '@/components/schedule-view-toggle'
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Infinity as InfinityIcon,
  Package,
  Repeat,
  Check,
} from 'lucide-react'

const WEEK_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DAY_LABEL_LONG: Record<number, string> = {
  1: 'los lunes', 2: 'los martes', 3: 'los miércoles',
  4: 'los jueves', 5: 'los viernes', 6: 'los sábados', 0: 'los domingos',
}

function startOfWeek(d: Date): Date {
  const day = d.getDay()
  const diff = (day + 6) % 7 // mover a lunes
  const monday = new Date(d)
  monday.setDate(d.getDate() - diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(d.getDate() + n)
  return r
}

function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatRange(start: Date, end: Date): string {
  const s = start.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
  const e = end.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
  return `${s} – ${e}`
}

// Argentina (UTC-3, sin DST) — parsea date+time como ART para que server y cliente coincidan.
function scheduleMs(date: string, startTime: string): number {
  return new Date(`${date}T${startTime.substring(0, 8)}-03:00`).getTime()
}

const LEVEL_RANK: Record<ClassLevel, number> = {
  principiante: 1,
  intermedio: 2,
  avanzado: 3,
  abierto: 0,
}
function canTakeLevel(userLevel: ClassLevel, classLevel: ClassLevel): boolean {
  if (classLevel === 'abierto') return true
  if (userLevel === 'abierto') return true
  return LEVEL_RANK[userLevel] >= LEVEL_RANK[classLevel]
}

export default function ClassesClient({
  schedules,
  token,
  classCount,
  summary,
  myBookings,
  myRecurring,
  userLevel,
  serverNowMs,
}: {
  schedules: Schedule[]
  token: string
  classCount: { count: number; limit: number | null }
  summary: MonthPaymentSummary
  myBookings: Booking[]
  myRecurring: RecurringBooking[]
  userLevel: ClassLevel
  serverNowMs: number
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  // Inicializamos desde `serverNowMs` (mismo número en server y cliente) para evitar mismatch de hidratación.
  // Después de montar, refrescamos a la hora real del cliente.
  const [nowMs, setNowMs] = useState<number>(serverNowMs)
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date(serverNowMs)))
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date(serverNowMs))
  const { view, setView } = usePersistedScheduleView('schedule-view:student', 'day')
  useEffect(() => {
    setNowMs(Date.now())
    setWeekStart(startOfWeek(new Date()))
    setSelectedDate(new Date())
  }, [])

  const noPack = summary.effectivePack === null
  const unlimited = classCount.limit === null
  const limitReached =
    !unlimited && classCount.limit !== null && classCount.count >= classCount.limit
  const blocked = noPack || limitReached
  const today = new Date(nowMs)
  const PAY_DEADLINE = 10
  const deadlinePassed = today.getDate() > PAY_DEADLINE
  const daysLeftToPay = PAY_DEADLINE - today.getDate()

  const todayIso = toISO(today)
  const currentMonthIso = todayIso.substring(0, 7)
  const weekEnd = addDays(weekStart, 5)
  const weekEndIso = toISO(weekEnd)
  const weekStartIso = toISO(weekStart)

  // Filtrar schedules de esta semana (lun-sáb)
  const weekSchedules = schedules.filter(
    (s) => s.date >= weekStartIso && s.date <= weekEndIso,
  )

  const byDay: Record<string, Schedule[]> = {}
  for (let i = 0; i < 6; i++) byDay[toISO(addDays(weekStart, i))] = []
  for (const s of weekSchedules) {
    if (byDay[s.date]) byDay[s.date].push(s)
  }
  for (const date in byDay) {
    byDay[date].sort((a, b) => a.startTime.localeCompare(b.startTime))
  }

  // Map: scheduleId -> Booking activa
  const bookingByScheduleId = new Map<string, Booking>()
  const activeBookings: Booking[] = []
  for (const b of myBookings) {
    if (
      b.status === 'confirmed' ||
      b.status === 'pending_confirmation' ||
      b.status === 'waitlist'
    ) {
      bookingByScheduleId.set(b.schedule.id, b)
      activeBookings.push(b)
    }
  }

  function hasTimeConflict(s: Schedule): boolean {
    return activeBookings.some(
      (b) =>
        b.schedule.id !== s.id &&
        b.schedule.date === s.date &&
        b.schedule.startTime < s.endTime &&
        b.schedule.endTime > s.startTime,
    )
  }

  function recurringFor(s: Schedule): RecurringBooking | null {
    const dow = new Date(s.date + 'T00:00:00').getDay()
    return (
      myRecurring.find(
        (r) =>
          r.isActive &&
          r.pilatesClass.id === s.pilatesClass.id &&
          r.dayOfWeek === dow &&
          r.startTime === s.startTime,
      ) ?? null
    )
  }

  async function handleBook(scheduleId: string) {
    setLoading(`book:${scheduleId}`)
    try {
      const booking = await bookingsApi.create(scheduleId, token)
      toast.success(
        booking.status === 'waitlist'
          ? 'Estás en lista de espera'
          : 'Reserva confirmada',
      )
      router.refresh()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo reservar'
      if (msg.toLowerCase().includes('pack') || msg.toLowerCase().includes('pago')) {
        toast.error(msg, {
          action: { label: 'Ir a pagos', onClick: () => router.push('/student/payments') },
        })
      } else {
        toast.error(msg)
      }
    } finally {
      setLoading(null)
    }
  }

  async function handleBookRecurring(s: Schedule) {
    const dayLabel = DAY_LABEL_LONG[new Date(s.date + 'T00:00:00').getDay()]
    if (!confirm(`Reservar ${dayLabel} a las ${s.startTime.substring(0, 5)} (clase ${s.pilatesClass.name})? Quedará fijo todos los meses que abones; este mes se reservan ahora y los próximos meses al pagar.`)) return
    setLoading(`book-rec:${s.id}`)
    try {
      const res = await recurringBookingsApi.create(s.id, token)
      toast.success(
        res.materializedCount > 0
          ? `Reservaste ${res.materializedCount} clase${res.materializedCount === 1 ? '' : 's'} de este mes. Para próximos meses, se reservan cuando pagás.`
          : 'Reserva fija creada. Se activarán al pagar el mes correspondiente.',
      )
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear la reserva fija')
    } finally {
      setLoading(null)
    }
  }

  async function handleCancel(bookingId: string) {
    if (!confirm('Cancelar esta reserva?')) return
    setLoading(`cancel:${bookingId}`)
    try {
      await bookingsApi.cancel(bookingId, token)
      toast.success('Reserva cancelada')
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cancelar')
    } finally {
      setLoading(null)
    }
  }

  async function handleCancelRecurring(recurring: RecurringBooking) {
    const dayLabel = DAY_LABEL_LONG[recurring.dayOfWeek]
    if (!confirm(`Cancelar todos ${dayLabel} a las ${recurring.startTime.substring(0, 5)}? Se cancelarán todas las clases futuras de esta serie.`)) return
    setLoading(`cancel-rec:${recurring.id}`)
    try {
      const res = await recurringBookingsApi.cancel(recurring.id, token)
      toast.success(
        res.cancelledCount > 0
          ? `Se cancelaron ${res.cancelledCount} clase${res.cancelledCount === 1 ? '' : 's'} futura${res.cancelledCount === 1 ? '' : 's'}`
          : 'Reserva fija cancelada',
      )
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cancelar la serie')
    } finally {
      setLoading(null)
    }
  }

  const selectedIso = toISO(selectedDate)
  const isSelectedToday = selectedIso === todayIso
  const daySchedules = schedules
    .filter((s) => s.date === selectedIso)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
  const myDaySchedules = daySchedules.filter((s) => bookingByScheduleId.has(s.id))
  const dayDisplaySchedules = myDaySchedules.length > 0 ? myDaySchedules : daySchedules

  function renderDayCard(s: Schedule) {
    const booking = bookingByScheduleId.get(s.id) ?? null
    const isPartOfRecurring = !!booking?.recurringBooking
    const recurringMatch = recurringFor(s)
    const isFull = s.enrolledCount >= s.maxCapacity
    const inPast = scheduleMs(s.date, s.startTime) <= nowMs
    const level = s.pilatesClass.level as ClassLevel
    const levelOk = canTakeLevel(userLevel, level)
    const isOtherMonth = s.date.substring(0, 7) !== currentMonthIso
    const timeConflict = !booking && hasTimeConflict(s)

    return (
      <Card
        key={s.id}
        className={`overflow-hidden relative ${inPast ? 'opacity-65' : ''}`}
      >
        <span
          aria-hidden="true"
          className={`absolute inset-y-0 left-0 w-1.5 ${LEVEL_STRIPE_BG[level]}`}
        />
        <CardContent className="p-4 pl-5 space-y-3">
          <div className="flex items-start gap-3">
            <p className="text-2xl font-semibold tabular leading-none w-[58px] shrink-0">
              {s.startTime.substring(0, 5)}
            </p>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-base font-medium truncate flex-1">
                  {s.pilatesClass.name}
                </p>
                <LevelMedal level={level} size="md" className="shrink-0" />
              </div>
              <p className="text-sm text-muted-foreground truncate">
                con {s.instructor.firstName} {s.instructor.lastName}
              </p>
            </div>
            <Badge
              variant={isFull ? 'destructive' : 'secondary'}
              className="text-xs tabular shrink-0"
            >
              {s.enrolledCount}/{s.maxCapacity}
            </Badge>
          </div>

          <div className="pt-2 border-t border-border/60">
            {booking ? (
              <div className="space-y-1.5">
                <Badge
                  variant={isPartOfRecurring ? 'default' : 'secondary'}
                  className="w-full justify-center text-xs gap-1 py-1"
                >
                  {isPartOfRecurring ? (
                    <><Repeat className="h-3.5 w-3.5" />Recurrente</>
                  ) : (
                    <><Check className="h-3.5 w-3.5" />Reservada</>
                  )}
                </Badge>
                {!inPast && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => handleCancel(booking.id)}
                    disabled={loading === `cancel:${booking.id}`}
                  >
                    Cancelar este día
                  </Button>
                )}
                {isPartOfRecurring && !inPast && booking.recurringBooking && (
                  <button
                    onClick={() => {
                      const rec = myRecurring.find((r) => r.id === booking.recurringBooking?.id)
                      if (rec) handleCancelRecurring(rec)
                    }}
                    className="w-full text-xs text-muted-foreground hover:text-destructive underline-offset-2 hover:underline transition-colors"
                  >
                    Cancelar serie
                  </button>
                )}
              </div>
            ) : inPast ? (
              <Badge variant="outline" className="w-full justify-center text-xs py-1">
                Pasada
              </Badge>
            ) : !levelOk ? (
              <Badge
                variant="outline"
                className="w-full justify-center text-xs capitalize gap-1 py-1"
                title={`Esta clase es nivel ${LEVEL_LABEL[level]}`}
              >
                <LevelMedal level={level} size="sm" className="text-current" />
                Nivel {LEVEL_LABEL[level]}
              </Badge>
            ) : isOtherMonth ? (
              <Badge variant="outline" className="w-full justify-center text-xs py-1">
                Próximo mes
              </Badge>
            ) : timeConflict ? (
              <Badge
                variant="outline"
                className="w-full justify-center text-xs py-1"
                title="Tenés otra clase reservada en este horario"
              >
                Horario ocupado
              </Badge>
            ) : (
              <div className="space-y-1.5">
                <Button
                  size="sm"
                  variant={isFull ? 'outline' : 'default'}
                  className="w-full"
                  onClick={() => handleBook(s.id)}
                  disabled={loading === `book:${s.id}` || blocked}
                  title={
                    noPack
                      ? 'Elegí y pagá un pack para reservar'
                      : limitReached
                        ? 'Alcanzaste el límite de tu pack'
                        : undefined
                  }
                >
                  {loading === `book:${s.id}` ? '…' : isFull ? 'Lista de espera' : 'Reservar'}
                </Button>
                {!isFull && !recurringMatch && !blocked && (
                  <button
                    onClick={() => handleBookRecurring(s)}
                    disabled={loading === `book-rec:${s.id}`}
                    className="w-full text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors flex items-center justify-center gap-1"
                  >
                    <Repeat className="h-3 w-3" />
                    Reservar {DAY_LABEL_LONG[new Date(s.date + 'T00:00:00').getDay()]}
                  </button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  function renderCard(s: Schedule) {
    const booking = bookingByScheduleId.get(s.id) ?? null
    const isPartOfRecurring = !!booking?.recurringBooking
    const recurringMatch = recurringFor(s)
    const isFull = s.enrolledCount >= s.maxCapacity
    const inPast = scheduleMs(s.date, s.startTime) <= nowMs
    const level = s.pilatesClass.level as ClassLevel
    const levelOk = canTakeLevel(userLevel, level)
    const isOtherMonth = s.date.substring(0, 7) !== currentMonthIso
    const timeConflict = !booking && hasTimeConflict(s)

    return (
      <Card
        key={s.id}
        className={`overflow-hidden relative ${inPast ? 'opacity-65' : ''}`}
      >
        <span
          aria-hidden="true"
          className={`absolute inset-y-0 left-0 w-1 ${LEVEL_STRIPE_BG[level]}`}
        />
        <CardContent className="p-3 pl-3.5 space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-base font-semibold tabular leading-none">
              {s.startTime.substring(0, 5)}
            </p>
            <Badge
              variant={isFull ? 'destructive' : 'secondary'}
              className="text-[10px] tabular shrink-0"
            >
              {s.enrolledCount}/{s.maxCapacity}
            </Badge>
          </div>
          <div>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium truncate flex-1">
                {s.pilatesClass.name}
              </p>
              <LevelMedal level={level} size="sm" className="shrink-0 mt-0.5" />
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {s.instructor.firstName} {s.instructor.lastName}
            </p>
          </div>

          {booking ? (
            <div className="space-y-1">
              <Badge
                variant={isPartOfRecurring ? 'default' : 'secondary'}
                className="w-full justify-center text-[11px] gap-1"
              >
                {isPartOfRecurring ? (
                  <><Repeat className="h-3 w-3" />Recurrente</>
                ) : (
                  <><Check className="h-3 w-3" />Reservada</>
                )}
              </Badge>
              {!inPast && (
                <Button
                  size="xs"
                  variant="outline"
                  className="w-full"
                  onClick={() => handleCancel(booking.id)}
                  disabled={loading === `cancel:${booking.id}`}
                >
                  Cancelar este día
                </Button>
              )}
              {isPartOfRecurring && !inPast && booking.recurringBooking && (
                <button
                  onClick={() => {
                    const rec = myRecurring.find((r) => r.id === booking.recurringBooking?.id)
                    if (rec) handleCancelRecurring(rec)
                  }}
                  className="w-full text-[11px] text-muted-foreground hover:text-destructive underline-offset-2 hover:underline transition-colors"
                >
                  Cancelar serie
                </button>
              )}
            </div>
          ) : inPast ? (
            <Badge variant="outline" className="w-full justify-center text-[11px]">
              Pasada
            </Badge>
          ) : !levelOk ? (
            <Badge
              variant="outline"
              className="w-full justify-center text-[11px] capitalize gap-1"
              title={`Esta clase es nivel ${LEVEL_LABEL[level]}`}
            >
              <LevelMedal level={level} size="sm" className="text-current" />
              Nivel {LEVEL_LABEL[level]}
            </Badge>
          ) : isOtherMonth ? (
            <Badge variant="outline" className="w-full justify-center text-[11px]">
              Próximo mes
            </Badge>
          ) : timeConflict ? (
            <Badge
              variant="outline"
              className="w-full justify-center text-[11px]"
              title="Tenés otra clase reservada en este horario"
            >
              Horario ocupado
            </Badge>
          ) : (
            <div className="space-y-1">
              <Button
                size="xs"
                variant={isFull ? 'outline' : 'default'}
                className="w-full"
                onClick={() => handleBook(s.id)}
                disabled={loading === `book:${s.id}` || blocked}
                title={
                  noPack
                    ? 'Elegí y pagá un pack para reservar'
                    : limitReached
                      ? 'Alcanzaste el límite de tu pack'
                      : undefined
                }
              >
                {loading === `book:${s.id}` ? '…' : isFull ? 'Lista de espera' : 'Reservar'}
              </Button>
              {!isFull && !recurringMatch && !blocked && (
                <button
                  onClick={() => handleBookRecurring(s)}
                  disabled={loading === `book-rec:${s.id}`}
                  className="w-full text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors flex items-center justify-center gap-1"
                >
                  <Repeat className="h-3 w-3" />
                  Reservar {DAY_LABEL_LONG[new Date(s.date + 'T00:00:00').getDay()]}
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-medium tracking-tight text-foreground">
          Clases disponibles
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">Reservá tu próxima sesión o fijá un horario</p>
      </div>

      {/* Mi plan del mes */}
      <Card
        className={
          noPack || limitReached ? 'border-amber-300 bg-amber-50/50' : ''
        }
      >
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-secondary shrink-0">
              {unlimited ? (
                <InfinityIcon className="h-5 w-5 text-primary" />
              ) : (
                <Package className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              {noPack ? (
                <>
                  <p className="text-sm font-medium">Sin pack este mes</p>
                  <p className="text-xs text-muted-foreground">
                    {deadlinePassed
                      ? `Venció el plazo (día ${PAY_DEADLINE}). Pagá el mes que viene a partir del 1.`
                      : daysLeftToPay === 0
                        ? `Último día para abonar este mes (día ${PAY_DEADLINE}).`
                        : `Tenés hasta el día ${PAY_DEADLINE} para abonar (${daysLeftToPay} día${daysLeftToPay === 1 ? '' : 's'}).`}
                  </p>
                </>
              ) : unlimited ? (
                <>
                  <p className="text-sm font-medium">{summary.effectivePack?.name} — uso libre</p>
                  <p className="text-xs text-muted-foreground">{classCount.count} clases reservadas este mes</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">{summary.effectivePack?.name}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                    <span>Clases este mes</span>
                    <span className="font-semibold text-foreground tabular">
                      {classCount.count}/{classCount.limit}
                    </span>
                  </div>
                  <div className="flex gap-1 mt-1">
                    {Array.from({ length: classCount.limit ?? 0 }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full ${
                          i < classCount.count ? 'bg-primary' : 'bg-muted'
                        }`}
                      />
                    ))}
                  </div>
                  {limitReached && (
                    <p className="text-xs text-amber-700 mt-1">Alcanzaste el límite. Podés upgradear desde Pagos.</p>
                  )}
                </>
              )}
            </div>
            <Link href="/student/payments">
              <Button variant={noPack ? 'default' : 'outline'} size="sm" className="shrink-0 gap-1.5">
                <CreditCard className="h-4 w-4" />
                {noPack ? 'Elegir pack' : 'Pagos'}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {view === 'day' ? (
        <div className="max-w-xl mx-auto w-full space-y-4">
          {/* Navegador diario */}
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

          {/* Cabecera del día */}
          <div className="text-center">
            <p className={`text-eyebrow capitalize ${isSelectedToday ? 'text-today-ink' : 'text-muted-foreground'}`}>
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

          {/* Lista del día */}
          {daySchedules.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Sin clases este día
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {dayDisplaySchedules.map((s) => renderDayCard(s))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Navegador semanal */}
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">{formatRange(weekStart, weekEnd)}</p>
              <p className="text-xs text-muted-foreground">Semana del {weekStart.toLocaleDateString('es-AR')}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setWeekStart(addDays(weekStart, -7))}
                aria-label="Semana anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>
                Esta semana
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setWeekStart(addDays(weekStart, 7))}
                aria-label="Semana siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <ScheduleViewToggle view={view} onChange={setView} />
            </div>
          </div>

          {/* Grilla semanal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {Array.from({ length: 6 }, (_, i) => {
              const date = addDays(weekStart, i)
              const iso = toISO(date)
              const isToday = iso === todayIso
              const list = byDay[iso] ?? []
              return (
                <div
                  key={iso}
                  className={
                    isToday
                      ? 'space-y-2 rounded-xl bg-today-bg/70 ring-1 ring-season/40 p-2'
                      : 'space-y-2'
                  }
                >
                  <div
                    className={
                      isToday
                        ? 'flex items-center justify-between pb-1.5 border-b-2 border-season'
                        : 'flex items-center justify-between pb-1.5 border-b border-border'
                    }
                  >
                    <div>
                      <p className={isToday ? 'text-eyebrow text-today-ink' : 'text-eyebrow'}>
                        {WEEK_DAYS[i]}
                      </p>
                      <p
                        className={
                          isToday
                            ? 'text-base font-semibold tabular text-today-ink'
                            : 'text-base font-semibold tabular'
                        }
                      >
                        {date.getDate()}
                      </p>
                    </div>
                    {isToday && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-season text-primary-foreground">
                        hoy
                      </span>
                    )}
                  </div>
                  {list.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">Sin clases</p>
                  ) : (
                    list.map((s) => renderCard(s))
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Reservas fijas — carrusel horizontal */}
      {myRecurring.length > 0 && (
        <div className="space-y-1.5 pt-2">
          <div className="flex items-center gap-2 px-1">
            <Repeat className="h-3.5 w-3.5 text-primary" />
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Tus reservas fijas
            </h2>
          </div>
          <div className="-mx-4 px-4 overflow-x-auto">
            <ul className="flex gap-2 w-max pb-1">
              {myRecurring.map((r) => (
                <li key={r.id} className="shrink-0">
                  <Badge variant="secondary" className="gap-1 px-2.5 py-1 text-xs whitespace-nowrap">
                    <Repeat className="h-3 w-3 shrink-0" />
                    {r.pilatesClass.name} · {DAY_LABEL_LONG[r.dayOfWeek]} {r.startTime.substring(0, 5)}
                    <button
                      onClick={() => handleCancelRecurring(r)}
                      disabled={loading === `cancel-rec:${r.id}`}
                      className="ml-1.5 text-muted-foreground hover:text-destructive transition-colors"
                      title="Cancelar serie"
                    >
                      ✕
                    </button>
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
