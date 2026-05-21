import Link from 'next/link'
import { getSession } from '@/lib/session'
import { paymentsApi, bookingsApi, recurringBookingsApi, proposalsApi } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Calendar,
  CalendarClock,
  Repeat,
  Wallet,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Receipt,
} from 'lucide-react'

const ARS = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

const DAY_LABEL_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const PAY_DEADLINE_DAY = 10

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

export default async function StudentHome() {
  const session = (await getSession())!
  const today = todayISO()
  const month = today.slice(0, 7)
  const now = Date.now()

  const [monthSummary, myBookings, recurringBookings, classCount, pendingProposals] = await Promise.all([
    paymentsApi.currentMonth(session.token).catch(() => null),
    bookingsApi.myBookings(session.token).catch(() => []),
    recurringBookingsApi.myActive(session.token).catch(() => []),
    bookingsApi.myClassCount(session.token, month).catch(() => ({ count: 0, limit: 0 })),
    proposalsApi.pending(session.token).catch(() => []),
  ])
  const proposalToPick = pendingProposals[0] ?? null

  const pendingPayment = monthSummary?.payments.find((p) => p.status === 'pending') ?? null
  const hasActivePack = monthSummary?.classLimit !== 0 && monthSummary?.effectivePack
  const isUnlimited = classCount.limit === null
  const dayOfMonth = new Date().getDate()
  const deadlinePassed = dayOfMonth > PAY_DEADLINE_DAY
  const daysLeftToPay = PAY_DEADLINE_DAY - dayOfMonth

  const monthEnd = `${month}-31`
  const futureBookings = myBookings
    .filter(
      (b) =>
        (b.status === 'confirmed' || b.status === 'pending_confirmation' || b.status === 'waitlist') &&
        scheduleStart(b.schedule.date, b.schedule.startTime) > now &&
        b.schedule.date >= today &&
        b.schedule.date <= monthEnd,
    )
    .sort((a, b) =>
      (a.schedule.date + a.schedule.startTime).localeCompare(b.schedule.date + b.schedule.startTime),
    )

  const nextBooking = futureBookings[0] ?? null
  const upcomingBookings = futureBookings.slice(0, 5)
  const sortedRecurring = [...recurringBookings].sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime),
  )

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-4xl font-medium tracking-tight text-foreground">
            Hola{session.user.firstName ? `, ${session.user.firstName}` : ''}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Tus clases y tu pack del mes</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" render={<Link href="/student/classes" />}>
            <Calendar className="h-4 w-4" />
            Reservar clase
          </Button>
          <Button variant="outline" size="sm" render={<Link href="/student/bookings" />}>
            <CalendarClock className="h-4 w-4" />
            Mis reservas
          </Button>
        </div>
      </div>

      {proposalToPick && (
        <PaymentBanner
          tone="warning"
          icon={AlertTriangle}
          title={`Elegí tus fijas de ${new Date(
            Number(proposalToPick.month.split('-')[0]),
            Number(proposalToPick.month.split('-')[1]) - 1,
          ).toLocaleString('es-AR', { month: 'long' })}`}
          description={`Tenés ${proposalToPick.candidates.length} fijas y tu pack permite ${proposalToPick.cap}. Elegí cuáles materializar antes de las 24hs.`}
          ctaLabel="Elegir clases"
          ctaHref={`/student/recurring/picks/${proposalToPick.id}`}
        />
      )}

      {pendingPayment ? (
        <PaymentBanner
          tone="pending"
          icon={Wallet}
          title="Tenés un pago pendiente"
          description={
            pendingPayment.pack
              ? `Pack ${pendingPayment.pack.name} · ${pendingPayment.amount ? ARS.format(pendingPayment.amount) : ''}`
              : 'Mirá tu pago en curso'
          }
          ctaLabel="Ir a pagar"
          ctaHref="/student/payments"
        />
      ) : !hasActivePack ? (
        deadlinePassed ? (
          <PaymentBanner
            tone="expired"
            icon={AlertTriangle}
            title="Venció el plazo de pago de este mes"
            description={`El pago se habilita de nuevo el 1° del mes que viene.`}
          />
        ) : (
          <PaymentBanner
            tone="warning"
            icon={Sparkles}
            title="Sin pack activo este mes"
            description={
              daysLeftToPay === 0
                ? 'Hoy es el último día para abonar.'
                : `Te quedan ${daysLeftToPay} ${daysLeftToPay === 1 ? 'día' : 'días'} para abonar (hasta el ${PAY_DEADLINE_DAY}).`
            }
            ctaLabel="Elegir pack"
            ctaHref="/student/payments"
          />
        )
      ) : null}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          href="/student/payments"
          icon={Sparkles}
          label="Pack del mes"
          value={
            hasActivePack && monthSummary?.effectivePack
              ? monthSummary.effectivePack.name
              : 'Sin pack'
          }
          hint={
            hasActivePack
              ? isUnlimited
                ? 'Clases ilimitadas'
                : `${classCount.count}/${classCount.limit} usadas`
              : 'Elegí un pack para reservar'
          }
          tone={hasActivePack ? 'success' : 'warning'}
        />
        <KpiCard
          href="/student/bookings"
          icon={CalendarClock}
          label="Próxima clase"
          value={nextBooking ? formatTime(nextBooking.schedule.startTime) : '—'}
          hint={
            nextBooking
              ? formatDayShort(nextBooking.schedule.date)
              : 'Sin reservas próximas'
          }
        />
        <KpiCard
          href="/student/bookings"
          icon={Calendar}
          label="Reservas este mes"
          value={futureBookings.length}
          hint={futureBookings.length === 0 ? 'Reservá tu próxima clase' : 'Próximas hasta fin de mes'}
        />
        <KpiCard
          href="/student/classes"
          icon={Repeat}
          label="Reservas fijas"
          value={sortedRecurring.length}
          hint={sortedRecurring.length === 0 ? 'Ninguna aún' : 'Se renuevan al pagar'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-medium">Próximas reservas</h2>
              </div>
              <Button variant="ghost" size="sm" render={<Link href="/student/bookings" />}>
                Ver todas
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {upcomingBookings.length === 0 ? (
              <EmptyRow
                icon={CheckCircle2}
                text="No tenés reservas próximas"
                cta={{ label: 'Reservar clase', href: '/student/classes' }}
              />
            ) : (
              <ul className="divide-y divide-border">
                {upcomingBookings.map((b) => {
                  const isWaitlist = b.status === 'waitlist'
                  return (
                    <li key={b.id} className="flex items-center gap-3 py-2.5">
                      <div className="w-28 shrink-0 capitalize">
                        <p className="text-sm font-medium tabular-nums">{formatDayShort(b.schedule.date)}</p>
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          {formatTime(b.schedule.startTime)}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{b.schedule.pilatesClass.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {b.schedule.instructor.firstName} {b.schedule.instructor.lastName}
                        </p>
                      </div>
                      {isWaitlist ? (
                        <Badge variant="secondary">En espera</Badge>
                      ) : b.recurringBooking ? (
                        <Badge variant="secondary">
                          <Repeat className="h-3 w-3 mr-1" />
                          Fija
                        </Badge>
                      ) : null}
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
              <Repeat className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-medium">Reservas fijas</h2>
              {sortedRecurring.length > 0 && (
                <Badge variant="secondary" className="ml-auto tabular-nums">
                  {sortedRecurring.length}
                </Badge>
              )}
            </div>
            {sortedRecurring.length === 0 ? (
              <EmptyRow
                icon={Sparkles}
                text="Sin reservas fijas aún"
                cta={{ label: 'Reservar fijo', href: '/student/classes' }}
              />
            ) : (
              <ul className="space-y-1.5">
                {sortedRecurring.map((r) => (
                  <li key={r.id}>
                    <Link
                      href="/student/classes"
                      className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-md hover:bg-muted transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{r.pilatesClass.name}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {DAY_LABEL_LONG[r.dayOfWeek]} · {formatTime(r.startTime)}
                        </p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function PaymentBanner({
  tone,
  icon: Icon,
  title,
  description,
  ctaLabel,
  ctaHref,
}: {
  tone: 'pending' | 'warning' | 'expired'
  icon: React.ElementType
  title: string
  description: string
  ctaLabel?: string
  ctaHref?: string
}) {
  const toneClass =
    tone === 'pending'
      ? 'border-amber-500/40 bg-amber-500/5'
      : tone === 'expired'
        ? 'border-red-500/40 bg-red-500/5'
        : 'border-primary/30 bg-primary/5'
  const iconClass =
    tone === 'pending'
      ? 'text-amber-700 bg-amber-500/15'
      : tone === 'expired'
        ? 'text-red-700 bg-red-500/15'
        : 'text-primary bg-primary/10'
  return (
    <Card className={toneClass}>
      <CardContent className="py-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${iconClass}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-[12rem]">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
          {ctaLabel && ctaHref && (
            <Button size="sm" render={<Link href={ctaHref} />}>
              <Receipt className="h-4 w-4" />
              {ctaLabel}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
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
              <p className="text-2xl font-semibold mt-0.5 tabular-nums truncate">{value}</p>
              {hint && <p className="text-xs text-muted-foreground mt-0.5 truncate">{hint}</p>}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function EmptyRow({
  icon: Icon,
  text,
  cta,
}: {
  icon: React.ElementType
  text: string
  cta?: { label: string; href: string }
}) {
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground py-2">
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{text}</span>
      {cta && (
        <Button variant="ghost" size="sm" render={<Link href={cta.href} />}>
          {cta.label}
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
