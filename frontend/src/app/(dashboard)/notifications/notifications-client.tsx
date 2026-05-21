'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { notificationsApi } from '@/lib/api'
import type { AppNotification } from '@/lib/definitions'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Bell, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

function formatFull(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function NotificationsClient({
  items: initialItems,
  token,
}: {
  items: AppNotification[]
  token: string
}) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  const unread = items.filter((n) => !n.isRead).length

  async function handleClick(n: AppNotification) {
    if (!n.isRead) {
      try {
        await notificationsApi.markRead(n.id, token)
        setItems((arr) => arr.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)))
      } catch {
        // ignore
      }
    }
    if (n.link) router.push(n.link)
  }

  async function handleMarkAll() {
    try {
      await notificationsApi.markAllRead(token)
      setItems((arr) => arr.map((x) => ({ ...x, isRead: true })))
      toast.success('Todas marcadas como leídas')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-medium tracking-tight text-foreground">Notificaciones</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {unread > 0 ? `${unread} sin leer` : 'Estás al día'}
          </p>
        </div>
        {unread > 0 && (
          <Button size="sm" variant="outline" onClick={handleMarkAll}>
            <Check className="h-4 w-4 mr-1" /> Marcar todas como leídas
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground space-y-2">
            <Bell className="h-8 w-8 mx-auto opacity-40" />
            <p>No tenés notificaciones todavía</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className="w-full text-left"
            >
              <Card className={cn('transition-colors hover:bg-muted/50', !n.isRead && 'border-primary/40 bg-primary/[0.03]')}>
                <CardContent className="py-3.5 flex items-start gap-3">
                  {!n.isRead && (
                    <span className="mt-2 w-2 h-2 rounded-full bg-primary shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn('text-sm', !n.isRead && 'font-medium')}>{n.title}</p>
                      <span className="text-xs text-muted-foreground shrink-0">{formatFull(n.createdAt)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
