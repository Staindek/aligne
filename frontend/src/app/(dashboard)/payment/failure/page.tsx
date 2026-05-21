import Link from 'next/link'
import { XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function PaymentFailurePage() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16 text-center max-w-sm mx-auto">
      <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center">
        <XCircle className="h-8 w-8 text-red-500" />
      </div>
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-medium tracking-tight text-foreground">El pago falló</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          No pudimos procesar tu pago. Podés intentarlo nuevamente desde la sección de pagos.
        </p>
      </div>
      <Button variant="outline" render={<Link href="/student/payments" />}>
        Volver a mis pagos
      </Button>
    </div>
  )
}
