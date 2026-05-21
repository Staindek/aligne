'use client'
import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { authApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft } from 'lucide-react'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const newPassword = fd.get('newPassword') as string
    const confirm = fd.get('confirm') as string

    if (newPassword !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }

    setPending(true)
    try {
      await authApi.resetPassword(token, newPassword)
      router.push('/login?reset=ok')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al restablecer la contraseña')
    } finally {
      setPending(false)
    }
  }

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-destructive">Link inválido o expirado.</p>
        <Link href="/forgot-password" className="text-sm text-primary hover:text-primary/80 font-medium">
          Solicitar nuevo link
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Nueva contraseña
        </h2>
        <p className="text-sm text-muted-foreground">
          Ingresá y confirmá tu nueva contraseña
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="newPassword">Nueva contraseña</Label>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            minLength={6}
            required
            className="h-11"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirmar contraseña</Label>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            minLength={6}
            required
            className="h-11"
          />
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/8 px-3 py-2.5 rounded-lg border border-destructive/20">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full h-11" disabled={pending}>
          {pending ? 'Guardando…' : 'Restablecer contraseña'}
        </Button>
      </form>

      <div className="text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al inicio de sesión
        </Link>
      </div>
    </>
  )
}

export default function ResetPasswordPage() {
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
          Un nuevo comienzo, con la misma dedicación.
        </p>
        <p className="text-primary-foreground/40 text-xs">
          © {new Date().getFullYear()} Aligné Studio
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="md:hidden text-center">
            <h1 className="font-wordmark text-foreground text-5xl font-light italic">Aligné</h1>
          </div>
          <Suspense fallback={<div className="h-40" />}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
