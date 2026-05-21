'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { bookingsApi } from '@/lib/api'
import type { Booking, ClassLevel } from '@/lib/definitions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { LevelMedal, LEVEL_STRIPE_BG } from '@/components/level-medal'
import { CalendarDays, Clock, X, Bell, Users } from 'lucide-react'

function formatTime(t: string) { return t.substring(0, 5) }
function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-AR', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Argentina/Buenos_Aires',
  })
}
function isoDayOnly(ms: number): string {
  const d = new Date(ms)
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(d)
}

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmada',
  waitlist: 'Lista de espera',
  cancelled: 'Cancelada',
  pending_confirmation: '¡Lugar disponible!',
}
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  confirmed: 'default',
  waitlist: 'secondary',
  cancelled: 'outline',
  pending_confirmation: 'default',
}

export default function BookingsClient({
  bookings,
  token,
  serverNowMs,
}: {
  bookings: Booking[]
  token: string
  serverNowMs: number
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState<number>(serverNowMs)
  useEffect(() => {
    setNowMs(Date.now())
  }, [])

  async function handleCancel(id: string) {
    if (!confirm('¿Cancelar esta reserva?')) return
    setLoading(`cancel-${id}`)
    try {
      await bookingsApi.cancel(id, token)
      toast.success('Reserva cancelada')
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cancelar')
    } finally { setLoading(null) }
  }

  async function handleConfirm(id: string) {
    setLoading(`confirm-${id}`)
    try {
      await bookingsApi.confirm(id, token)
      toast.success('¡Lugar confirmado!')
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'No se pudo confirmar')
    } finally { setLoading(null) }
  }

  function bookingMs(b: Booking): number {
    // Argentina (UTC-3) explícito para coincidir entre server (UTC) y cliente (ART).
    return new Date(`${b.schedule.date}T${b.schedule.startTime.substring(0, 8)}-03:00`).getTime()
  }
  const active = bookings
    .filter((b) => b.status !== 'cancelled')
    .sort((a, b) => {
      const aT = bookingMs(a)
      const bT = bookingMs(b)
      const aFuture = aT >= nowMs
      const bFuture = bT >= nowMs
      if (aFuture !== bFuture) return aFuture ? -1 : 1
      return aFuture ? aT - bT : bT - aT
    })
  const past = bookings
    .filter((b) => b.status === 'cancelled')
    .sort((a, b) => bookingMs(b) - bookingMs(a))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-medium tracking-tight text-foreground">Mis reservas</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Tu historial y próximas clases</p>
      </div>

      {active.length === 0 && past.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No tenés reservas aún</CardContent></Card>
      ) : (
        <>
          {active.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Próximas</h2>
              {active.map((b) => {
                const level = b.schedule.pilatesClass.level as ClassLevel
                const isTodayBooking = b.schedule.date === isoDayOnly(nowMs)
                return (
                <Card
                  key={b.id}
                  className={
                    'relative overflow-hidden ' +
                    (b.status === 'pending_confirmation'
                      ? 'border-primary/50 bg-primary/5 '
                      : '') +
                    (isTodayBooking ? 'ring-1 ring-season/45 bg-today-bg/40' : '')
                  }
                >
                  <span
                    aria-hidden="true"
                    className={`absolute inset-y-0 left-0 w-1 ${LEVEL_STRIPE_BG[level]}`}
                  />
                  <CardContent className="flex items-center gap-4 py-4 pl-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{b.schedule.pilatesClass.name}</p>
                        <LevelMedal level={level} size="sm" />
                        {isTodayBooking && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-season text-primary-foreground">
                            hoy
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />{formatDate(b.schedule.date)}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />{formatTime(b.schedule.startTime)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {b.schedule.instructor.firstName} {b.schedule.instructor.lastName}
                        </span>
                      </div>

                      {/* Waitlist info */}
                      {b.status === 'waitlist' && b.waitlistPosition !== undefined && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Users className="h-3 w-3" />
                          Posición {b.waitlistPosition} en lista
                          {b.waitlistTotal && b.waitlistTotal > 1 && ` · ${b.waitlistTotal - 1} persona${b.waitlistTotal - 1 !== 1 ? 's' : ''} más esperando`}
                        </p>
                      )}

                      {/* Pending confirmation deadline */}
                      {b.status === 'pending_confirmation' && b.confirmationDeadline && (
                        <p className="text-xs text-primary font-medium flex items-center gap-1 mt-1">
                          <Bell className="h-3 w-3" />
                          Confirmá antes de las {new Date(b.confirmationDeadline).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={STATUS_VARIANT[b.status]}>{STATUS_LABEL[b.status]}</Badge>

                      {b.status === 'pending_confirmation' && (
                        <Button
                          size="sm"
                          onClick={() => handleConfirm(b.id)}
                          disabled={loading === `confirm-${b.id}`}
                        >
                          {loading === `confirm-${b.id}` ? '…' : 'Confirmar'}
                        </Button>
                      )}

                      {(b.status === 'confirmed' || b.status === 'waitlist') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleCancel(b.id)}
                          disabled={loading === `cancel-${b.id}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
                )
              })}
            </section>
          )}

          {past.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Canceladas</h2>
              {past.map((b) => (
                <Card key={b.id} className="opacity-60">
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{b.schedule.pilatesClass.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(b.schedule.date)} · {formatTime(b.schedule.startTime)}
                      </p>
                    </div>
                    <Badge variant="outline">{STATUS_LABEL[b.status]}</Badge>
                  </CardContent>
                </Card>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}
