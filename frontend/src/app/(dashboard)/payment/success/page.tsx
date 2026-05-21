import Link from 'next/link'
import { CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function PaymentSuccessPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16 text-center max-w-sm mx-auto">
      <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
        <CheckCircle className="h-8 w-8 text-emerald-600" />
      </div>
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-medium tracking-tight text-foreground">¡Pago confirmado!</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Tu pago fue procesado correctamente. Ya podés reservar tus clases del mes.
        </p>
      </div>
      <Button render={<Link href="/student/classes" />}>
        Ver clases disponibles
      </Button>
    </div>
  )
}
