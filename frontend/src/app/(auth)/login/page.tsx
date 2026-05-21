'use client'
import { useActionState } from 'react'
import Link from 'next/link'
import { loginAction } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const [error, action, pending] = useActionState(loginAction, null)

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

        <blockquote className="space-y-3">
          <p className="text-primary-foreground/90 text-xl font-normal leading-relaxed">
            "El movimiento consciente transforma el cuerpo y la mente."
          </p>
          <footer className="text-primary-foreground/60 text-sm">— Sofi Páez</footer>
        </blockquote>

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
              Bienvenida
            </h2>
            <p className="text-sm text-muted-foreground">
              Ingresá tu email y contraseña para continuar
            </p>
          </div>

          <form action={action} className="space-y-5">
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

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contraseña</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
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
              {pending ? 'Ingresando…' : 'Ingresar'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            ¿No tenés cuenta?{' '}
            <Link href="/register" className="text-primary hover:text-primary/80 font-medium transition-colors">
              Crear cuenta
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
