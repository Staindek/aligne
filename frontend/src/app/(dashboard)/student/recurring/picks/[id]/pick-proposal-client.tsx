'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { proposalsApi } from '@/lib/api'
import type { MaterializationProposal, Schedule } from '@/lib/definitions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { CalendarDays, Clock, AlertCircle, CheckCircle2 } from 'lucide-react'

function formatMonth(month: string): string {
  const [year, m] = month.split('-')
  return new Date(Number(year), Number(m) - 1).toLocaleString('es-AR', {
    month: 'long',
    year: 'numeric',
  })
}

function formatDayLong(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function formatTime(t: string): string {
  return t.substring(0, 5)
}

function formatDeadline(deadline: string, nowMs: number): string {
  const ms = new Date(deadline).getTime() - nowMs
  if (ms <= 0) return 'Vencido'
  const hours = Math.floor(ms / (1000 * 60 * 60))
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  if (hours >= 1) return `Te quedan ${hours}h ${minutes}m`
  return `Te quedan ${minutes}m`
}

export default function PickProposalClient({
  proposal,
  schedules,
  token,
  serverNowMs,
}: {
  proposal: MaterializationProposal
  schedules: Schedule[]
  token: string
  serverNowMs: number
}) {
  const router = useRouter()
  const [nowMs, setNowMs] = useState<number>(serverNowMs)
  useEffect(() => {
    setNowMs(Date.now())
    const t = setInterval(() => setNowMs(Date.now()), 60000)
    return () => clearInterval(t)
  }, [])

  // Orden estable: por prioridad (más antigua primero) → date + startTime
  const sortedCandidates = useMemo(() => {
    const schedById = new Map(schedules.map((s) => [s.id, s]))
    return [...proposal.candidates]
      .map((c) => ({ candidate: c, schedule: schedById.get(c.scheduleId) }))
      .filter((x): x is { candidate: typeof x.candidate; schedule: Schedule } => !!x.schedule)
      .sort((a, b) => {
        if (a.candidate.priority !== b.candidate.priority) {
          return a.candidate.priority - b.candidate.priority
        }
        return (a.schedule.date + a.schedule.startTime).localeCompare(
          b.schedule.date + b.schedule.startTime,
        )
      })
  }, [proposal.candidates, schedules])

  // Pre-selecciona las primeras `cap` candidatas (las más antiguas) como sugerencia
  const [selected, setSelected] = useState<Set<string>>(() => {
    const ids = sortedCandidates.slice(0, proposal.cap).map((x) => x.schedule.id)
    return new Set(ids)
  })
  const [submitting, setSubmitting] = useState(false)

  const remaining = proposal.cap - selected.size
  const overCap = selected.size > proposal.cap
  const canSubmit = !submitting && !overCap

  function toggle(scheduleId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(scheduleId)) {
        next.delete(scheduleId)
      } else {
        if (next.size >= proposal.cap) {
          toast.error(`Tu pack permite hasta ${proposal.cap} clases este mes.`)
          return prev
        }
        next.add(scheduleId)
      }
      return next
    })
  }

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const res = await proposalsApi.resolve(proposal.id, Array.from(selected), token)
      toast.success(`Se materializaron ${res.materialized} clases para ${formatMonth(proposal.month)}`)
      router.push('/student/bookings')
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar la elección')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-medium tracking-tight text-foreground capitalize">
          Elegí tus fijas — {formatMonth(proposal.month)}
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Tenés más reservas fijas que clases en tu pack. Marcá las que querés materializar para este mes.
        </p>
      </div>

      <Card className="border-amber-300 bg-amber-50/40">
        <CardContent className="py-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-9 h-9 rounded-full bg-amber-500/15 text-amber-700 flex items-center justify-center shrink-0">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-[12rem]">
              <p className="text-sm font-medium">
                Pack permite {proposal.cap} clases · {sortedCandidates.length} candidatas
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDeadline(proposal.deadlineAt, nowMs)} — pasado el plazo, dejamos las fijas más antiguas y descartamos el resto.
              </p>
            </div>
            <Badge variant={overCap ? 'destructive' : remaining === 0 ? 'default' : 'secondary'}>
              {selected.size}/{proposal.cap} elegidas
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {sortedCandidates.map(({ candidate, schedule }) => {
          const isSelected = selected.has(schedule.id)
          return (
            <Card
              key={candidate.scheduleId}
              className={
                isSelected ? 'border-primary/60 bg-primary/5 transition-colors' : 'transition-colors'
              }
            >
              <CardContent className="py-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary shrink-0"
                    checked={isSelected}
                    onChange={() => toggle(schedule.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{schedule.pilatesClass.name}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                      <span className="text-xs text-muted-foreground flex items-center gap-1 capitalize">
                        <CalendarDays className="h-3 w-3" />
                        {formatDayLong(schedule.date)}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(schedule.startTime)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {schedule.instructor.firstName} {schedule.instructor.lastName}
                      </span>
                    </div>
                  </div>
                  {isSelected ? (
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  ) : null}
                </label>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="sticky bottom-4 flex items-center justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => router.push('/student')}
          disabled={submitting}
        >
          Volver
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {submitting
            ? 'Guardando…'
            : `Confirmar (${selected.size}/${proposal.cap})`}
        </Button>
      </div>
    </div>
  )
}
