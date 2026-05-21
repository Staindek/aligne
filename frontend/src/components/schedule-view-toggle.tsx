'use client'
import { useEffect, useState } from 'react'
import { Calendar, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ScheduleView = 'day' | 'week'

export function usePersistedScheduleView(key: string, defaultValue: ScheduleView = 'day') {
  const [view, setViewState] = useState<ScheduleView>(defaultValue)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(key)
    if (stored === 'day' || stored === 'week') setViewState(stored)
  }, [key])
  function setView(next: ScheduleView) {
    setViewState(next)
    if (typeof window !== 'undefined') window.localStorage.setItem(key, next)
  }
  return { view, setView }
}

export function ScheduleViewToggle({
  view,
  onChange,
}: {
  view: ScheduleView
  onChange: (v: ScheduleView) => void
}) {
  const base =
    'inline-flex items-center gap-1.5 px-2.5 h-7 rounded text-xs font-medium transition-colors'
  return (
    <div
      className="inline-flex rounded-md border border-border bg-background p-0.5"
      role="tablist"
      aria-label="Vista del calendario"
    >
      <button
        type="button"
        role="tab"
        aria-selected={view === 'day'}
        onClick={() => onChange('day')}
        className={cn(
          base,
          view === 'day'
            ? 'bg-secondary text-secondary-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Calendar className="h-3.5 w-3.5" />
        Día
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === 'week'}
        onClick={() => onChange('week')}
        className={cn(
          base,
          view === 'week'
            ? 'bg-secondary text-secondary-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <CalendarDays className="h-3.5 w-3.5" />
        Semana
      </button>
    </div>
  )
}
