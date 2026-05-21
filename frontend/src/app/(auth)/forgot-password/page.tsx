'use client'
import { useState } from 'react'
import Link from 'next/link'
import { authApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const email = fd.get('email') as string
    try {
      await authApi.forgotPassword(email)
      setSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al procesar la solicitud')
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
          Estamos aquí para ayudarte a volver.
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

          {sent ? (
            <div className="space-y-6 text-center">
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  Revisá tu email
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Si el email está registrado, recibirás instrucciones para restablecer tu contraseña.
                </p>
              </div>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  Recuperar contraseña
                </h2>
                <p className="text-sm text-muted-foreground">
                  Ingresá tu email y te enviaremos instrucciones
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="ana@ejemplo.com"
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
                  {pending ? 'Enviando…' : 'Enviar instrucciones'}
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
          )}
        </div>
      </div>
    </div>
  )
}
