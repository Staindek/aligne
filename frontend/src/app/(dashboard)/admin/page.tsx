import Link from 'next/link'
import { getSession } from '@/lib/session'
import {
  usersApi,
  schedulesApi,
  instructorsApi,
  paymentsApi,
  invitationsApi,
  reportsApi,
} from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  CalendarPlus,
  Receipt,
  BarChart3,
  Wallet,
  CalendarClock,
  ClipboardCheck,
  AlertTriangle,
  ChevronRight,
  Mail,
  TriangleAlert,
  CheckCircle2,
} from 'lucide-react'

const ARS = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function currentMonthISO(): string {
  return todayISO().slice(0, 7)
}

export default async function AdminHome() {
  const session = (await getSession())!
  const today = todayISO()
  const month = currentMonthISO()

  const [users, todaySchedules, allSchedules, instructors, payments, pendingInvites, report] = await Promise.all([
    usersApi.list(session.token).catch(() => []),
    schedulesApi.list(session.token, today).catch(() => []),
    schedulesApi.list(session.token).catch(() => []),
    instructorsApi.list(session.token).catch(() => []),
    paymentsApi.adminList(session.token).catch(() => []),
    invitationsApi.pending(session.token).catch(() => []),
    reportsApi.summary(session.token, month).catch(() => null),
  ])

  const activeStudents = users.filter((u) => u.role === 'student' && u.isActive).length
  const todayCount = todaySchedules.length
  const todayEnrolled = todaySchedules.reduce((a, s) => a + s.enrolledCount, 0)
  const todayCapacity = todaySchedules.reduce((a, s) => a + s.maxCapacity, 0)

  const pendingPayments = payments.filter((p) => p.status === 'pending')
  const monthIncome = report?.income.total ?? 0
  const pendingAttendance = report?.attendance.pending ?? 0

  // Próximas 7 jornadas (incluyendo hoy)
  const upcoming = allSchedules
    .filter((s) => s.date >= today)
    .slice(0, 50)

  // Clases con cupo bajo en próximas 24-48hs (≤ 30% ocupado)
  const lowOccupancy = upcoming
    .filter((s) => s.maxCapacity > 0 && s.enrolledCount / s.maxCapacity <= 0.3)
    .slice(0, 5)

  const expiringInvites = pendingInvites.filter((inv) => {
    const days = (new Date(inv.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return days <= 3
  })

  const alertsCount = pendingPayments.length + expiringInvites.length + lowOccupancy.length

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-4xl font-medium tracking-tight text-foreground">
            Hola{session.user.firstName ? `, ${session.user.firstName}` : ''}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Resumen del estudio</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" render={<Link href="/admin/schedules" />}>
            <CalendarPlus className="h-4 w-4" />
            Agendar clase
          </Button>
          <Button variant="outline" size="sm" render={<Link href="/admin/payments" />}>
            <Receipt className="h-4 w-4" />
            Registrar pago
          </Button>
          <Button variant="outline" size="sm" render={<Link href="/admin/reports" />}>
            <BarChart3 className="h-4 w-4" />
            Reportes
          </Button>
        </div>
      </div>

      {/* KPIs accionables */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          href={`/admin/reports?month=${month}`}
          icon={Wallet}
          label="Ingresos del mes"
          value={ARS.format(monthIncome)}
          hint={report ? `${report.income.paidCount} pagos confirmados` : '—'}
          tone="success"
        />
        <KpiCard
          href="/admin/users"
          icon={Users}
          label="Alumnxs activxs"
          value={activeStudents}
          hint={`${instructors.length} instructoras`}
        />
        <KpiCard
          href="/admin/schedules"
          icon={CalendarClock}
          label="Clases hoy"
          value={todayCount}
          hint={todayCount > 0 ? `${todayEnrolled}/${todayCapacity} reservas` : 'Sin clases'}
        />
        <KpiCard
          href="/admin/reports"
          icon={ClipboardCheck}
          label="Asistencia pendiente"
          value={pendingAttendance}
          hint={pendingAttendance === 0 ? 'Todo marcado' : 'Por marcar este mes'}
          tone={pendingAttendance > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Clases de hoy */}
        <Card className="lg:col-span-2">
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-medium">Clases de hoy</h2>
              </div>
              <Button variant="ghost" size="sm" render={<Link href="/admin/schedules" />}>
                Ver semana
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {todaySchedules.length === 0 ? (
              <EmptyRow icon={CheckCircle2} text="No hay clases agendadas para hoy" />
            ) : (
              <ul className="divide-y divide-border">
                {todaySchedules.map((s) => {
                  const occ = s.maxCapacity > 0 ? s.enrolledCount / s.maxCapacity : 0
                  return (
                    <li key={s.id} className="flex items-center gap-3 py-2.5">
                      <div className="w-16 shrink-0">
                        <p className="text-sm font-semibold tabular">{s.startTime.substring(0, 5)}</p>
                        <p className="text-[11px] text-muted-foreground tabular">{s.endTime.substring(0, 5)}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.pilatesClass.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {s.instructor.firstName} {s.instructor.lastName}
                        </p>
                      </div>
                      <Badge
                        variant={occ >= 0.8 ? 'default' : occ <= 0.3 ? 'destructive' : 'secondary'}
                        className="tabular"
                      >
                        {s.enrolledCount}/{s.maxCapacity}
                      </Badge>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Necesita atención */}
        <Card>
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-medium">Necesita atención</h2>
              {alertsCount > 0 && (
                <Badge variant="secondary" className="ml-auto tabular">{alertsCount}</Badge>
              )}
            </div>
            {alertsCount === 0 ? (
              <EmptyRow icon={CheckCircle2} text="Todo en orden" />
            ) : (
              <ul className="space-y-1.5">
                {pendingPayments.length > 0 && (
                  <AlertRow
                    href="/admin/payments"
                    icon={Wallet}
                    label="Pagos pendientes"
                    count={pendingPayments.length}
                  />
                )}
                {expiringInvites.length > 0 && (
                  <AlertRow
                    href="/admin/invitations"
                    icon={Mail}
                    label="Invitaciones por expirar"
                    count={expiringInvites.length}
                  />
                )}
                {lowOccupancy.length > 0 && (
                  <AlertRow
                    href="/admin/schedules"
                    icon={TriangleAlert}
                    label="Clases con poca ocupación"
                    count={lowOccupancy.length}
                  />
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
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
              <p className="text-2xl font-semibold mt-0.5 tabular">{value}</p>
              {hint && <p className="text-xs text-muted-foreground mt-0.5 truncate">{hint}</p>}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function AlertRow({
  href,
  icon: Icon,
  label,
  count,
}: {
  href: string
  icon: React.ElementType
  label: string
  count: number
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-md hover:bg-muted transition-colors"
      >
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm flex-1 truncate">{label}</span>
        <Badge variant="secondary" className="tabular">{count}</Badge>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
      </Link>
    </li>
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
