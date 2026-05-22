'use client'
import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { authApi, invitationsApi } from '@/lib/api'
import type { InvitationPreview } from '@/lib/definitions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const ROLE_LABEL: Record<string, string> = {
  admin: 'administradorx',
  instructor: 'instructora',
  student: 'alumnx',
}

export default function RegisterPage() {
  // Suspense boundary requerido por useSearchParams() en next build.
  return (
    <Suspense fallback={null}>
      <RegisterPageContent />
    </Suspense>
  )
}

function RegisterPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get('invite')

  const [pending, setPending] = useState(false)
  const [invite, setInvite] = useState<InvitationPreview | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [loadingInvite, setLoadingInvite] = useState(!!inviteToken)

  useEffect(() => {
    if (!inviteToken) return
    setLoadingInvite(true)
    invitationsApi
      .byToken(inviteToken)
      .then((data) => setInvite(data))
      .catch((e: unknown) => {
        setInviteError(e instanceof Error ? e.message : 'Invitación inválida')
      })
      .finally(() => setLoadingInvite(false))
  }, [inviteToken])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    const fd = new FormData(e.currentTarget)
    const data: Record<string, string> = Object.fromEntries(fd) as Record<string, string>
    if (inviteToken) data.invitationToken = inviteToken
    if (invite) data.email = invite.email

    try {
      await authApi.register(data)
      toast.success('Cuenta creada. Podés ingresar ahora.')
      router.push('/login')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al registrarse')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden md:flex flex-col justify-between bg-primary px-12 py-14">
        <div>
          <p className="text-primary-foreground/60 text-sm tracking-[0.2em] uppercase font-light">
            Estudio
          </p>
          <h1 className="font-wordmark text-primary-foreground text-6xl font-light italic mt-1 leading-none">
            Aligné
          </h1>
        </div>

        <p className="text-primary-foreground/80 text-lg font-normal leading-relaxed">
          Cada sesión es un paso hacia tu mejor versión.
        </p>

        <p className="text-primary-foreground/40 text-xs">
          © {new Date().getFullYear()} Aligné Studio
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="md:hidden text-center">
            <h1 className="font-wordmark text-foreground text-5xl font-light italic">
              Aligné
            </h1>
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Crear cuenta
            </h2>
            <p className="text-sm text-muted-foreground">
              {invite
                ? `Fuiste invitadx a unirte como ${ROLE_LABEL[invite.role] ?? invite.role}.`
                : 'Completá tus datos para unirte al estudio'}
            </p>
          </div>

          {loadingInvite && (
            <p className="text-sm text-muted-foreground">Validando invitación…</p>
          )}

          {inviteError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {inviteError}
            </div>
          )}

          {!loadingInvite && !inviteError && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nombre</Label>
                  <Input name="firstName" required className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label>Apellido</Label>
                  <Input name="lastName" required className="h-11" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  name="email"
                  type="email"
                  required
                  className="h-11"
                  defaultValue={invite?.email ?? ''}
                  readOnly={!!invite}
                />
                {invite && (
                  <p className="text-[11px] text-muted-foreground">
                    Este email fue fijado por la invitación.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Teléfono <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Input name="phone" type="tel" className="h-11" />
              </div>

              <div className="space-y-1.5">
                <Label>Contraseña</Label>
                <Input name="password" type="password" minLength={6} required className="h-11" />
              </div>

              <Button type="submit" className="w-full h-11" disabled={pending}>
                {pending ? 'Creando cuenta…' : 'Registrarse'}
              </Button>
            </form>
          )}

          <p className="text-center text-sm text-muted-foreground">
            ¿Ya tenés cuenta?{' '}
            <Link href="/login" className="text-primary hover:text-primary/80 font-medium transition-colors">
              Ingresá aquí
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
