'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { paymentsApi } from '@/lib/api'
import type { Pack, Payment } from '@/lib/definitions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CheckCircle, Clock, AlertCircle, CreditCard, ArrowDownCircle, Package, Infinity as InfinityIcon } from 'lucide-react'

const STATUS_CONFIG = {
  paid: { label: 'Pagado', icon: CheckCircle, variant: 'default' as const, className: 'text-emerald-600' },
  pending: { label: 'Pendiente', icon: Clock, variant: 'secondary' as const, className: 'text-amber-600' },
  failed: { label: 'Fallido', icon: AlertCircle, variant: 'destructive' as const, className: 'text-destructive' },
}

const ARS = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

function formatMonth(month: string) {
  const [year, m] = month.split('-')
  return new Date(Number(year), Number(m) - 1).toLocaleString('es-AR', { month: 'long', year: 'numeric' })
}

function nextMonthOf(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const ny = m === 12 ? y + 1 : y
  const nm = m === 12 ? 1 : m + 1
  return `${ny}-${String(nm).padStart(2, '0')}`
}

function isWithin15DaysOfMonthEnd(month: string): boolean {
  const [y, m] = month.split('-').map(Number)
  const monthEnd = new Date(y, m, 0)
  monthEnd.setHours(23, 59, 59, 999)
  const msToEnd = monthEnd.getTime() - Date.now()
  if (msToEnd < 0) return false
  return msToEnd / (1000 * 60 * 60 * 24) <= 15
}

function packRank(pack: Pack | null | undefined): number {
  if (!pack) return -1
  if (pack.classCount === null) return Number.POSITIVE_INFINITY
  return pack.classCount
}

export default function AdminPaymentsClient({
  payments,
  packs,
  token,
}: {
  payments: Payment[]
  packs: Pack[]
  token: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [changing, setChanging] = useState<Payment | null>(null)

  async function handleMarkPaid(id: string) {
    setLoading(id)
    try {
      await paymentsApi.adminMarkPaid(id, token)
      toast.success('Pago marcado como pagado')
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(null)
    }
  }

  async function handleChangePack(
    payment: Payment,
    newPackId: string,
    newPackName: string,
    moneyCredit: number,
    classCredit: number,
  ) {
    const within15 = isWithin15DaysOfMonthEnd(payment.month)
    const willBeClassCredit = within15 && classCredit > 0
    const msg = willBeClassCredit
      ? `Cambiar el pack de ${payment.user.firstName} a "${newPackName}". Se le suman ${classCredit} ${
          classCredit === 1 ? 'clase' : 'clases'
        } extra para ${formatMonth(nextMonthOf(payment.month))}.`
      : `Cambiar el pack de ${payment.user.firstName} a "${newPackName}". ${
          moneyCredit > 0
            ? `Se le suman ${ARS.format(moneyCredit)} de crédito.`
            : 'No genera crédito.'
        }`
    if (!confirm(msg)) return
    setLoading(`change-${payment.id}-${newPackId}`)
    try {
      const res = await paymentsApi.adminChangePack(
        payment.user.id,
        newPackId,
        token,
        payment.month,
      )
      if (res.creditType === 'classes' && res.creditAdded > 0) {
        toast.success(
          `Pack cambiado · ${res.creditAdded} ${
            res.creditAdded === 1 ? 'clase' : 'clases'
          } extra para ${formatMonth(res.creditTargetMonth ?? '')}`,
        )
      } else if (res.creditAdded > 0) {
        toast.success(`Pack cambiado · ${ARS.format(res.creditAdded)} de crédito sumado`)
      } else {
        toast.success('Pack cambiado')
      }
      setChanging(null)
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cambiar el pack')
    } finally {
      setLoading(null)
    }
  }

  const pending = payments.filter((p) => p.status !== 'paid')
  const paid = payments.filter((p) => p.status === 'paid')

  const currentMonthISO = new Date().toISOString().slice(0, 7)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-medium tracking-tight text-foreground">Pagos</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Estado de pagos de todxs lxs alumnxs</p>
      </div>

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Pendientes / Fallidos</h2>
          {pending.map((p) => {
            const cfg = STATUS_CONFIG[p.status]
            const Icon = cfg.icon
            return (
              <Card key={p.id} className="border-amber-200">
                <CardContent className="flex items-center gap-4 py-4">
                  <Icon className={`h-5 w-5 shrink-0 ${cfg.className}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">
                      {p.user.firstName} {p.user.lastName}
                      {p.pack && (
                        <span className="text-muted-foreground font-normal"> · {p.pack.name}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {formatMonth(p.month)} · {p.user.email}
                      {p.amount != null && ` · ${ARS.format(Number(p.amount))}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMarkPaid(p.id)}
                      disabled={loading === p.id}
                      className="gap-1.5"
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      {loading === p.id ? '…' : 'Marcar pagado'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </section>
      )}

      {paid.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Pagados</h2>
          {paid.map((p) => {
            const canDowngrade = p.month >= currentMonthISO && p.pack !== null
            return (
              <Card key={p.id}>
                <CardContent className="flex items-center gap-4 py-4">
                  <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">
                      {p.user.firstName} {p.user.lastName}
                      {p.pack && (
                        <span className="text-muted-foreground font-normal"> · {p.pack.name}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {formatMonth(p.month)}
                      {p.paidAt && ` · ${new Date(p.paidAt).toLocaleDateString('es-AR')}`}
                      {p.amount != null && ` · ${ARS.format(Number(p.amount))}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canDowngrade && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setChanging(p)}
                        className="gap-1.5"
                        title="Bajar pack (genera crédito)"
                      >
                        <ArrowDownCircle className="h-3.5 w-3.5" />
                        Bajar pack
                      </Button>
                    )}
                    <Badge variant="default">Pagado</Badge>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </section>
      )}

      {payments.length === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No hay registros de pago</CardContent></Card>
      )}

      <Dialog open={!!changing} onOpenChange={(o) => !o && setChanging(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Bajar pack de {changing?.user.firstName} {changing?.user.lastName}
            </DialogTitle>
          </DialogHeader>
          {changing && (
            <div className="space-y-3 pt-2">
              <p className="text-sm text-muted-foreground capitalize">
                {formatMonth(changing.month)} · pack actual{' '}
                <span className="font-medium text-foreground">{changing.pack?.name}</span>
                {changing.amount != null && (
                  <> · pago {ARS.format(Number(changing.amount))}</>
                )}
              </p>
              <div className="space-y-2">
                {packs
                  .filter((pk) => packRank(pk) < packRank(changing.pack))
                  .map((pk) => {
                    const moneyCredit = Math.max(0, Number(changing.amount ?? 0) - Number(pk.price))
                    const oldCount = changing.pack?.classCount ?? null
                    const newCount = pk.classCount
                    const bothFinite = oldCount !== null && newCount !== null
                    const classCredit = bothFinite
                      ? Math.max(0, (oldCount as number) - (newCount as number))
                      : 0
                    const within15 = isWithin15DaysOfMonthEnd(changing.month)
                    const showClassCredit = within15 && classCredit > 0
                    const loadKey = `change-${changing.id}-${pk.id}`
                    return (
                      <Card key={pk.id} className="border-dashed">
                        <CardContent className="py-3 flex items-center gap-3">
                          {pk.classCount === null ? (
                            <InfinityIcon className="h-4 w-4 text-primary shrink-0" />
                          ) : (
                            <Package className="h-4 w-4 text-primary shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{pk.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {pk.classCount === null
                                ? 'Ilimitadas'
                                : `${pk.classCount} clases`}
                              {' · '}
                              {ARS.format(Number(pk.price))}
                            </p>
                            {showClassCredit ? (
                              <p className="text-xs text-emerald-700 mt-0.5 capitalize">
                                +{classCredit} {classCredit === 1 ? 'clase' : 'clases'} para {formatMonth(nextMonthOf(changing.month))}
                              </p>
                            ) : moneyCredit > 0 ? (
                              <p className="text-xs text-emerald-700 mt-0.5">
                                +{ARS.format(moneyCredit)} de crédito al alumnx
                              </p>
                            ) : null}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleChangePack(changing, pk.id, pk.name, moneyCredit, classCredit)
                            }
                            disabled={loading === loadKey}
                          >
                            Bajar a este
                          </Button>
                        </CardContent>
                      </Card>
                    )
                  })}
                {packs.filter((pk) => packRank(pk) < packRank(changing.pack)).length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No hay packs menores disponibles.
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
