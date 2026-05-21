'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { schedulesApi } from '@/lib/api'
import type { PilatesClass, Instructor } from '@/lib/definitions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// Lunes primero (orden argentino), pero map a Date.getDay() (0=Domingo)
const DAYS: { value: number; short: string; long: string }[] = [
  { value: 1, short: 'L', long: 'Lunes' },
  { value: 2, short: 'M', long: 'Martes' },
  { value: 3, short: 'X', long: 'Miércoles' },
  { value: 4, short: 'J', long: 'Jueves' },
  { value: 5, short: 'V', long: 'Viernes' },
  { value: 6, short: 'S', long: 'Sábado' },
  { value: 0, short: 'D', long: 'Domingo' },
]

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number)
  const total = h * 60 + m + minutes
  const nh = Math.floor(total / 60) % 24
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}

export default function BulkScheduleForm({
  classes,
  instructors,
  token,
  onDone,
}: {
  classes: PilatesClass[]
  instructors: Instructor[]
  token: string
  onDone: () => void
}) {
  const currentMonth = new Date().toISOString().slice(0, 7)

  const [pending, setPending] = useState(false)
  const [classId, setClassId] = useState(classes[0]?.id ?? '')
  const [instructorId, setInstructorId] = useState(instructors[0]?.id ?? '')
  const [days, setDays] = useState<Set<number>>(new Set())
  const [startTime, setStartTime] = useState('09:00')
  const [startMonth, setStartMonth] = useState(currentMonth)
  const [monthCount, setMonthCount] = useState(1)

  const selectedClass = classes.find((c) => c.id === classId)
  const endTime = selectedClass ? addMinutes(startTime, selectedClass.durationMinutes) : ''

  const range = (() => {
    const [y, m] = startMonth.split('-').map(Number)
    const start = new Date(y, m - 1, 1)
    const end = new Date(y, m - 1 + monthCount, 0) // último día del mes (m + count - 1)
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      label: end.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
      startLabel: start.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
    }
  })()

  function toggleDay(d: number) {
    setDays((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (days.size === 0) return toast.error('Elegí al menos un día de la semana')
    if (!classId || !instructorId) return toast.error('Faltan modalidad o instructora')

    setPending(true)
    try {
      const result = await schedulesApi.bulkCreate(
        {
          pilatesClassId: classId,
          instructorId,
          daysOfWeek: Array.from(days),
          startTime,
          startDate: range.startDate,
          endDate: range.endDate,
        },
        token,
      )
      const c = result.created.length
      const s = result.skipped.length
      if (c === 0 && s > 0) {
        toast.error(`No se agendó ninguna clase. ${s} omitidas por superposición.`)
      } else if (s > 0) {
        toast.success(`Se agendaron ${c} clases. ${s} omitidas por superposición.`)
      } else {
        toast.success(`Se agendaron ${c} clases`)
      }
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
        {classes.length === 0
          ? 'Creá al menos una modalidad antes de agendar clases.'
          : 'Creá al menos una instructora antes de agendar clases.'}
      </p>
    )
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

      <div className="space-y-1.5">
        <Label>Días de la semana</Label>
        <div className="flex gap-1.5 flex-wrap">
          {DAYS.map((d) => {
            const active = days.has(d.value)
            return (
              <button
                key={d.value}
                type="button"
                onClick={() => toggleDay(d.value)}
                title={d.long}
                className={cn(
                  'inline-flex items-center justify-center w-9 h-9 rounded-md text-sm font-medium border transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-input hover:border-border hover:text-foreground',
                )}
              >
                {d.short}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Hora de inicio</Label>
          <Input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Hora de fin</Label>
          <Input value={endTime} disabled />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Mes inicial</Label>
          <Input
            type="month"
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Cantidad de meses</Label>
          <Input
            type="number"
            min={1}
            max={12}
            value={monthCount}
            onChange={(e) => setMonthCount(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
            required
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Se agendarán las clases semanales{' '}
        <span className="font-medium text-foreground capitalize">
          {monthCount === 1 ? `de ${range.startLabel}` : `desde ${range.startLabel} hasta ${range.label}`}
        </span>.
        Cada clase queda independiente — la podés editar o cancelar después.
      </p>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Agendando…' : 'Agendar clases'}
      </Button>
    </form>
  )
}
