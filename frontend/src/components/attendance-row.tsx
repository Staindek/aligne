'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { bookingsApi } from '@/lib/api'
import type { AttendanceStatus, Booking } from '@/lib/definitions'
import { Check, X, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LevelMedal } from '@/components/level-medal'

const OPTIONS: { value: AttendanceStatus; label: string; icon: React.ElementType; activeClass: string }[] = [
  { value: 'present', label: 'Presente', icon: Check, activeClass: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/40' },
  { value: 'absent', label: 'Ausente', icon: X, activeClass: 'bg-red-500/15 text-red-700 border-red-500/40' },
  { value: 'pending', label: 'Pendiente', icon: Minus, activeClass: 'bg-muted text-muted-foreground border-border' },
]

export default function AttendanceRow({
  booking,
  token,
  canMark,
}: {
  booking: Booking
  token: string
  canMark: boolean
}) {
  const [status, setStatus] = useState<AttendanceStatus>(booking.attendanceStatus)
  const [pending, setPending] = useState<AttendanceStatus | null>(null)

  async function setAttendance(value: AttendanceStatus) {
    if (value === status) return
    setPending(value)
    try {
      await bookingsApi.markAttendance(booking.id, value, token)
      setStatus(value)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al marcar')
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-2">
      <div className="min-w-0 sm:flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{booking.user.firstName} {booking.user.lastName}</p>
          <LevelMedal level={booking.user.level} size="sm" className="shrink-0" />
        </div>
        <p className="text-xs text-muted-foreground truncate">{booking.user.email}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0 self-start sm:self-auto">
        {OPTIONS.map(({ value, label, icon: Icon, activeClass }) => {
          const isActive = status === value
          const isPending = pending === value
          return (
            <button
              key={value}
              type="button"
              disabled={!canMark || pending !== null}
              onClick={() => setAttendance(value)}
              aria-label={label}
              className={cn(
                'inline-flex items-center justify-center gap-1 px-2 h-7 rounded-md border text-xs whitespace-nowrap transition-colors',
                isActive ? activeClass : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
                (!canMark || pending !== null) && 'opacity-50 cursor-not-allowed',
                isPending && 'opacity-70',
              )}
              title={!canMark ? 'Disponible una vez que empiece la clase' : label}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
