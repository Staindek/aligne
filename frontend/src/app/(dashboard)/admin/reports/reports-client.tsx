'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { reportsApi } from '@/lib/api'
import type { ReportSummary } from '@/lib/definitions'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  DollarSign,
  CalendarDays,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  BookOpen,
} from 'lucide-react'

const ARS = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

function monthLabel(month: string): string {
  const [y, m] = month.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleString('es-AR', { month: 'long', year: 'numeric' })
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'default',
}: {
  icon: React.ElementType
  label: string
  value: string | number
  hint?: string
  tone?: 'default' | 'success' | 'danger'
}) {
  const toneClass =
    tone === 'success'
      ? 'text-emerald-700 bg-emerald-500/10'
      : tone === 'danger'
        ? 'text-red-700 bg-red-500/10'
        : 'text-primary bg-secondary'
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${toneClass}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-semibold mt-0.5">{value}</p>
            {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function ReportsClient({
  initial,
  month,
  token,
}: {
  initial: ReportSummary | null
  month: string
  token: string
}) {
  const router = useRouter()
  const [data, setData] = useState<ReportSummary | null>(initial)
  const [currentMonth, setCurrentMonth] = useState(month)
  const [pending, startTransition] = useTransition()

  function changeMonth(next: string) {
    setCurrentMonth(next)
    startTransition(async () => {
      const fresh = await reportsApi.summary(token, next).catch(() => null)
      setData(fresh)
      router.replace(`/admin/reports?month=${next}`)
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-4xl font-medium tracking-tight text-foreground capitalize">
            Reportes — {monthLabel(currentMonth)}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Resumen mensual del estudio</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Mes</Label>
          <Input
            type="month"
            value={currentMonth}
            onChange={(e) => changeMonth(e.target.value)}
            disabled={pending}
            className="w-44"
          />
        </div>
      </div>

      {!data ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No se pudieron cargar los reportes</CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              icon={DollarSign}
              label="Ingresos"
              value={ARS.format(data.income.total)}
              hint={`${data.income.paidCount} pagos confirmados`}
              tone="success"
            />
            <StatCard
              icon={CalendarDays}
              label="Clases"
              value={data.classes.completed}
              hint={`${data.classes.scheduled} agendadas · ${data.classes.cancelled} canceladas`}
            />
            <StatCard
              icon={CheckCircle2}
              label="Asistencia"
              value={`${data.attendance.rate}%`}
              hint={`${data.attendance.present} presentes · ${data.attendance.absent} faltas`}
              tone={data.attendance.rate >= 80 ? 'success' : 'default'}
            />
            <StatCard
              icon={AlertCircle}
              label="Faltas totales"
              value={data.noShows}
              hint={data.attendance.pending > 0 ? `${data.attendance.pending} aún sin marcar` : 'Asistencia al día'}
              tone={data.noShows > 5 ? 'danger' : 'default'}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardContent className="py-4 space-y-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <h2 className="font-medium text-sm">Modalidades más reservadas</h2>
                </div>
                {data.topClasses.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin datos para este mes</p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.topClasses.map((c, i) => (
                      <li key={i} className="flex items-center justify-between text-sm">
                        <span className="truncate">{c.name}</span>
                        <Badge variant="secondary">{c.bookings} reservas</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="py-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <h2 className="font-medium text-sm">Horarios más populares</h2>
                </div>
                {data.topTimeslots.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin datos para este mes</p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.topTimeslots.map((t, i) => (
                      <li key={i} className="flex items-center justify-between text-sm">
                        <span>{t.startTime} hs</span>
                        <Badge variant="secondary">{t.bookings} reservas</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="py-4 space-y-3">
              <h2 className="text-sm font-medium">Detalle de asistencia</h2>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="flex items-center gap-2 rounded-md bg-emerald-500/5 px-3 py-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="text-muted-foreground">Presentes</span>
                  <span className="font-semibold tabular-nums">{data.attendance.present}</span>
                </div>
                <div className="flex items-center gap-2 rounded-md bg-red-500/5 px-3 py-2">
                  <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                  <span className="text-muted-foreground">Ausentes</span>
                  <span className="font-semibold tabular-nums">{data.attendance.absent}</span>
                </div>
                <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2">
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Pendientes</span>
                  <span className="font-semibold tabular-nums">{data.attendance.pending}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
