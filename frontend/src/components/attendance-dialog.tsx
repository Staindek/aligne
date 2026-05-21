'use client'
import { useEffect, useState } from 'react'
import { bookingsApi } from '@/lib/api'
import type { Booking, Schedule } from '@/lib/definitions'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ClipboardCheck } from 'lucide-react'
import AttendanceRow from './attendance-row'

function formatTime(t: string) { return t.substring(0, 5) }
function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

function scheduleStart(s: Schedule): Date {
  return new Date(`${s.date}T${s.startTime.substring(0, 5)}:00`)
}

export default function AttendanceDialog({
  schedule,
  token,
}: {
  schedule: Schedule
  token: string
}) {
  const [open, setOpen] = useState(false)
  const [bookings, setBookings] = useState<Booking[] | null>(null)
  const canMark = scheduleStart(schedule).getTime() <= Date.now()

  useEffect(() => {
    if (!open) return
    setBookings(null)
    bookingsApi
      .bySchedule(schedule.id, token)
      .then((b) => setBookings(b.filter((x) => x.status === 'confirmed')))
      .catch(() => setBookings([]))
  }, [open, schedule.id, token])

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        title="Asistencia"
      >
        <ClipboardCheck className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Asistencia</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="text-sm">
              <p className="font-medium">{schedule.pilatesClass.name}</p>
              <p className="text-muted-foreground text-xs">
                {formatDate(schedule.date)} · {formatTime(schedule.startTime)}–{formatTime(schedule.endTime)} · {schedule.instructor.firstName} {schedule.instructor.lastName}
              </p>
            </div>
            {!canMark && (
              <p className="text-xs text-muted-foreground bg-muted rounded-md px-3 py-2">
                La clase aún no empezó. Vas a poder marcar asistencia cuando comience.
              </p>
            )}
            {bookings === null ? (
              <p className="text-sm text-muted-foreground text-center py-4">Cargando…</p>
            ) : bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin alumnxs inscriptxs</p>
            ) : (
              <div className="divide-y divide-border/60">
                {bookings.map((b) => (
                  <AttendanceRow key={b.id} booking={b} token={token} canMark={canMark} />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
