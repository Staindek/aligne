'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { usersApi } from '@/lib/api'
import type { ClassLevel, UserRole } from '@/lib/definitions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { UserPlus } from 'lucide-react'

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'student', label: 'Alumnx' },
  { value: 'instructor', label: 'Instructora' },
  { value: 'admin', label: 'Admin' },
]

const LEVELS: { value: ClassLevel; label: string }[] = [
  { value: 'principiante', label: 'Principiante' },
  { value: 'intermedio', label: 'Intermedio' },
  { value: 'avanzado', label: 'Avanzado' },
  { value: 'abierto', label: 'Sin restricción' },
]

export default function CreateUserButton({ token }: { token: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<UserRole>('student')
  const [level, setLevel] = useState<ClassLevel>('principiante')

  function reset() {
    setFirstName(''); setLastName(''); setEmail(''); setPassword(''); setPhone('')
    setRole('student'); setLevel('principiante')
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    try {
      await usersApi.create(
        {
          firstName, lastName, email, password,
          ...(phone ? { phone } : {}),
          role,
          ...(role === 'student' ? { level } : {}),
        },
        token,
      )
      toast.success('Usuarix creadx')
      reset()
      setOpen(false)
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al crear usuarix')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm"><UserPlus className="h-4 w-4" />Nuevo usuarix</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>Crear usuarix</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Apellido</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Contraseña</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="6+ caracteres"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono (opcional)</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+54..." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Rol</Label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
              >
                {ROLES.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
              </select>
            </div>
            {role === 'student' && (
              <div className="space-y-1.5">
                <Label>Nivel</Label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as ClassLevel)}
                  className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                >
                  {LEVELS.map((l) => (<option key={l.value} value={l.value}>{l.label}</option>))}
                </select>
              </div>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Creando…' : 'Crear usuarix'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
