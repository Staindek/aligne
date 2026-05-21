'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { instructorsApi, invitationsApi } from '@/lib/api'
import type { Instructor } from '@/lib/definitions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Trash2, Plus, UserCircle, Mail, Copy, Check } from 'lucide-react'

function inviteUrl(token: string): string {
  if (typeof window === 'undefined') return `/register?invite=${token}`
  return `${window.location.origin}/register?invite=${token}`
}

function InstructorForm({ token, onDone }: { token: string; onDone: () => void }) {
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    const fd = new FormData(e.currentTarget)
    const data = Object.fromEntries(fd)
    try {
      await instructorsApi.create(data, token)
      toast.success('Instructora creada')
      onDone()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally { setPending(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Nombre</Label><Input name="firstName" required /></div>
        <div className="space-y-1.5"><Label>Apellido</Label><Input name="lastName" required /></div>
      </div>
      <div className="space-y-1.5"><Label>Email</Label><Input name="email" type="email" required /></div>
      <div className="space-y-1.5"><Label>Teléfono</Label><Input name="phone" /></div>
      <div className="space-y-1.5"><Label>Especialidad</Label><Input name="specialty" placeholder="Reformer, Mat…" /></div>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Guardando…' : 'Crear instructora'}</Button>
    </form>
  )
}

export default function InstructorsClient({ instructors, token }: { instructors: Instructor[]; token: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [inviting, setInviting] = useState<string | null>(null)
  const [inviteLink, setInviteLink] = useState<{ email: string; url: string } | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleRemove(id: string) {
    if (!confirm('¿Desactivar esta instructora?')) return
    try {
      await instructorsApi.remove(id, token)
      toast.success('Instructora desactivada')
      router.refresh()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error') }
  }

  async function handleInvite(instructor: Instructor) {
    setInviting(instructor.id)
    try {
      const inv = await invitationsApi.create(
        { email: instructor.email, role: 'instructor' },
        token,
      )
      setInviteLink({ email: instructor.email, url: inviteUrl(inv.token) })
      toast.success('Link generado')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setInviting(null)
    }
  }

  async function copyToClipboard(url: string) {
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl font-medium tracking-tight text-foreground">Instructoras</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Equipo del estudio Aligné</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm"><Plus className="h-4 w-4 mr-1" />Nueva</Button>} />
          <DialogContent>
            <DialogHeader><DialogTitle>Nueva instructora</DialogTitle></DialogHeader>
            <InstructorForm token={token} onDone={() => { setOpen(false); router.refresh() }} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {instructors.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No hay instructoras registradas</CardContent></Card>
        ) : instructors.map((i) => (
          <Card key={i.id}>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent shrink-0">
                <UserCircle className="h-5 w-5 text-accent-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{i.firstName} {i.lastName}</p>
                <p className="text-xs text-muted-foreground">{i.email}{i.specialty ? ` · ${i.specialty}` : ''}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => handleInvite(i)}
                  disabled={inviting === i.id}
                  title="Generar link de invitación"
                >
                  <Mail className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => handleRemove(i.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!inviteLink} onOpenChange={(o) => !o && setInviteLink(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Link de invitación</DialogTitle></DialogHeader>
          {inviteLink && (
            <div className="space-y-3 pt-2">
              <p className="text-sm text-muted-foreground">
                Copiá este link y mandáselo a <span className="font-medium text-foreground">{inviteLink.email}</span> por WhatsApp, email o el medio que prefieras. Vence en 7 días.
              </p>
              <div className="flex items-center gap-2">
                <Input value={inviteLink.url} readOnly className="font-mono text-xs" />
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(inviteLink.url)}>
                  {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
