'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { invitationsApi } from '@/lib/api'
import type { Invitation, UserRole } from '@/lib/definitions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Mail, Copy, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin',
  instructor: 'Instructora',
  student: 'Alumnx',
}

function inviteUrl(token: string): string {
  if (typeof window === 'undefined') return `/register?invite=${token}`
  return `${window.location.origin}/register?invite=${token}`
}

function invitationStatus(inv: Invitation): 'pendiente' | 'usada' | 'expirada' {
  if (inv.usedAt) return 'usada'
  if (new Date(inv.expiresAt) < new Date()) return 'expirada'
  return 'pendiente'
}

function NewInvitationForm({
  token,
  onCreated,
}: {
  token: string
  onCreated: (inv: Invitation) => void
}) {
  const [pending, setPending] = useState(false)
  const [role, setRole] = useState<UserRole>('student')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    const fd = new FormData(e.currentTarget)
    const email = String(fd.get('email') ?? '').trim()
    try {
      const inv = await invitationsApi.create({ email, role }, token)
      toast.success('Invitación creada')
      onCreated(inv)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input name="email" type="email" required placeholder="camila@aligne.com" />
      </div>
      <div className="space-y-1.5">
        <Label>Rol</Label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
        >
          <option value="student">Alumnx</option>
          <option value="instructor">Instructora</option>
        </select>
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Generando…' : 'Crear invitación'}
      </Button>
    </form>
  )
}

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Link copiado')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('No se pudo copiar')
    }
  }
  return (
    <Button size="sm" variant="outline" onClick={copy}>
      {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
      {copied ? 'Copiado' : 'Copiar link'}
    </Button>
  )
}

export default function InvitationsClient({
  items: initialItems,
  token,
}: {
  items: Invitation[]
  token: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState(initialItems)
  const [latestUrl, setLatestUrl] = useState<string | null>(null)

  async function handleRevoke(id: string) {
    if (!confirm('¿Revocar esta invitación?')) return
    try {
      await invitationsApi.revoke(id, token)
      toast.success('Invitación revocada')
      setItems((arr) => arr.map((x) => (x.id === id ? { ...x, usedAt: new Date().toISOString() } : x)))
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
  }

  function handleCreated(inv: Invitation) {
    const url = inviteUrl(inv.token)
    setLatestUrl(url)
    setItems((arr) => [inv, ...arr])
    setOpen(false)
  }

  const pending = items.filter((i) => invitationStatus(i) === 'pendiente')
  const history = items.filter((i) => invitationStatus(i) !== 'pendiente')

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-medium tracking-tight text-foreground">Invitaciones</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Generá links para que instructoras y alumnxs creen su cuenta
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm"><Plus className="h-4 w-4 mr-1" />Nueva</Button>} />
          <DialogContent>
            <DialogHeader><DialogTitle>Nueva invitación</DialogTitle></DialogHeader>
            <NewInvitationForm token={token} onCreated={handleCreated} />
          </DialogContent>
        </Dialog>
      </div>

      {latestUrl && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4 space-y-2">
            <p className="text-sm font-medium">Invitación generada — copiá el link y compartilo:</p>
            <div className="flex items-center gap-2">
              <Input value={latestUrl} readOnly className="font-mono text-xs" />
              <CopyButton url={latestUrl} />
            </div>
            <p className="text-xs text-muted-foreground">Vence en 7 días.</p>
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Pendientes ({pending.length})</h2>
        {pending.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No hay invitaciones pendientes</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {pending.map((inv) => {
              const url = inviteUrl(inv.token)
              return (
                <Card key={inv.id}>
                  <CardContent className="py-3 flex items-center gap-3">
                    <div className="flex items-center justify-center w-9 h-9 rounded-full bg-secondary shrink-0">
                      <Mail className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{inv.email}</p>
                        <Badge variant="outline" className="text-xs">{ROLE_LABEL[inv.role]}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Vence {new Date(inv.expiresAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <CopyButton url={url} />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleRevoke(inv.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {history.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Historial ({history.length})</h2>
          <div className="space-y-2">
            {history.map((inv) => {
              const status = invitationStatus(inv)
              return (
                <Card key={inv.id} className="opacity-60">
                  <CardContent className="py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm truncate">{inv.email}</p>
                        <Badge variant="outline" className="text-xs">{ROLE_LABEL[inv.role]}</Badge>
                      </div>
                      <p className={cn(
                        'text-xs',
                        status === 'usada' ? 'text-emerald-600' : 'text-muted-foreground',
                      )}>
                        {status === 'usada' ? `Usada ${inv.usedAt ? new Date(inv.usedAt).toLocaleDateString('es-AR') : ''}` : 'Expirada'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
