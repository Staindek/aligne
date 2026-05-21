import Link from 'next/link'
import { Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function PaymentPendingPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16 text-center max-w-sm mx-auto">
      <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
        <Clock className="h-8 w-8 text-amber-600" />
      </div>
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-medium tracking-tight text-foreground">Pago pendiente</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Tu pago está siendo procesado. Te notificaremos cuando sea confirmado. Podés verificar el estado en la sección de pagos.
        </p>
      </div>
      <Button variant="outline" render={<Link href="/student/payments" />}>
        Ver estado del pago
      </Button>
    </div>
  )
}
