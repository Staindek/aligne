'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { schedulesApi } from '@/lib/api'
import type { Schedule, PilatesClass } from '@/lib/definitions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Pencil } from 'lucide-react'

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number)
  const total = h * 60 + m + minutes
  const nh = Math.floor(total / 60) % 24
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
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

function formatDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-AR', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

export default function EditSessionButton({
  schedule,
  classes,
  token,
}: {
  schedule: Schedule
  classes: PilatesClass[]
  token: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [classId, setClassId] = useState(schedule.pilatesClass.id)
  const [dow, setDow] = useState<number>(new Date(schedule.date + 'T00:00:00').getDay())
  const [keepOriginalDate, setKeepOriginalDate] = useState(true)
  const [startTime, setStartTime] = useState(schedule.startTime.substring(0, 5))

  const selectedClass = classes.find((c) => c.id === classId)
  const endTime = selectedClass ? addMinutes(startTime, selectedClass.durationMinutes) : ''
  const date = keepOriginalDate ? schedule.date : nextDateForDow(dow)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    try {
      await schedulesApi.update(
        schedule.id,
        { pilatesClassId: classId, date, startTime, endTime },
        token,
      )
      toast.success('Clase actualizada')
      setOpen(false)
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground">
            <Pencil className="h-4 w-4" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader><DialogTitle>Editar mi clase</DialogTitle></DialogHeader>
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
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {keepOriginalDate ? 'Fecha actual: ' : 'Se moverá a: '}
            <span className="font-medium text-foreground capitalize">{formatDate(date)}</span>
            {endTime && <> · termina <span className="font-medium text-foreground">{endTime}</span></>}
          </p>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
