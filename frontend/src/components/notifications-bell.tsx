'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Bell, Check } from 'lucide-react'
import { notificationsApi } from '@/lib/api'
import type { AppNotification } from '@/lib/definitions'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const POLL_MS = 30_000

function formatRelative(iso: string): string {
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'recién'
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffHrs = Math.floor(diffMin / 60)
  if (diffHrs < 24) return `hace ${diffHrs} h`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays < 7) return `hace ${diffDays} d`
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

export default function NotificationsBell({ token }: { token: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(0)
  const [items, setItems] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(false)

  const refreshCount = useCallback(async () => {
    try {
      const { count } = await notificationsApi.unreadCount(token)
      setCount(count)
    } catch {
      // silenciar errores de polling
    }
  }, [token])

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const data = await notificationsApi.list(token)
      setItems(data.slice(0, 8))
    } catch {
      // silenciar
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void refreshCount()
    const id = setInterval(() => void refreshCount(), POLL_MS)
    return () => clearInterval(id)
  }, [refreshCount])

  useEffect(() => {
    if (open) void loadList()
  }, [open, loadList])

  async function handleClick(n: AppNotification) {
    if (!n.isRead) {
      try {
        await notificationsApi.markRead(n.id, token)
        setCount((c) => Math.max(0, c - 1))
        setItems((arr) => arr.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)))
      } catch {
        // silenciar
      }
    }
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  async function handleMarkAllRead() {
    try {
      await notificationsApi.markAllRead(token)
      setCount(0)
      setItems((arr) => arr.map((x) => ({ ...x, isRead: true })))
    } catch {
      // silenciar
    }
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        type="button"
        className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground relative"
        onClick={() => setOpen((o) => !o)}
      >
        <Bell className="h-4 w-4" />
        Notificaciones
        {count > 0 && (
          <span className="ml-auto inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </Button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* Panel */}
          <div className="absolute bottom-full left-0 right-0 mb-1 z-50 w-72 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-sm font-medium">Notificaciones</span>
              {count > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <Check className="h-3 w-3" /> Marcar todas
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <p className="text-xs text-muted-foreground px-3 py-4 text-center">Cargando…</p>
              ) : items.length === 0 ? (
                <p className="text-xs text-muted-foreground px-3 py-6 text-center">No tenés notificaciones</p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={cn(
                      'w-full text-left px-3 py-2.5 border-b border-border/60 last:border-0 hover:bg-muted transition-colors',
                      !n.isRead && 'bg-primary/5',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {!n.isRead && (
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-xs leading-tight', !n.isRead && 'font-medium')}>
                          {n.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                          {n.body}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                          {formatRelative(n.createdAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-border">
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="block px-3 py-2 text-xs text-center text-primary hover:bg-muted"
              >
                Ver todas
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
