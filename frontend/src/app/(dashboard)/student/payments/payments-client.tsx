'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { paymentsApi } from '@/lib/api'
import type { Pack, Payment, MonthPaymentSummary } from '@/lib/definitions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  CreditCard,
  CheckCircle,
  Clock,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Package,
  Infinity as InfinityIcon,
} from 'lucide-react'

const ARS = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

const STATUS_CONFIG = {
  paid: { label: 'Pagado', icon: CheckCircle, variant: 'default' as const, className: 'text-emerald-600' },
  pending: { label: 'Pendiente', icon: Clock, variant: 'secondary' as const, className: 'text-amber-600' },
  failed: { label: 'Fallido', icon: AlertCircle, variant: 'destructive' as const, className: 'text-destructive' },
}

function formatMonth(month: string) {
  const [year, m] = month.split('-')
  return new Date(Number(year), Number(m) - 1).toLocaleString('es-AR', {
    month: 'long',
    year: 'numeric',
  })
}

function nextMonthOf(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const ny = m === 12 ? y + 1 : y
  const nm = m === 12 ? 1 : m + 1
  return `${ny}-${String(nm).padStart(2, '0')}`
}

function isWithin15DaysOfMonthEnd(month: string, nowMs: number): boolean {
  const [y, m] = month.split('-').map(Number)
  const monthEnd = new Date(y, m, 0)
  monthEnd.setHours(23, 59, 59, 999)
  const msToEnd = monthEnd.getTime() - nowMs
  if (msToEnd < 0) return false
  return msToEnd / (1000 * 60 * 60 * 24) <= 15
}

// Rank: ilimitado > número mayor; null/0 = sin pack
function packRank(pack: Pack | null): number {
  if (!pack) return -1
  if (pack.classCount === null) return Number.POSITIVE_INFINITY
  return pack.classCount
}

function ClassUsage({
  count,
  limit,
}: {
  count: number
  limit: number | null
}) {
  if (limit === null) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <InfinityIcon className="h-4 w-4 text-primary" />
        <span className="text-muted-foreground">Clases este mes</span>
        <span className="ml-auto font-semibold">Uso libre · {count} reservadas</span>
      </div>
    )
  }
  if (limit === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No tenés un pack activo este mes.
      </p>
    )
  }
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Clases este mes</span>
        <span className="font-semibold">
          {count}/{limit}
        </span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: limit }).map((_, i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded-full transition-colors ${
              i < count ? 'bg-primary' : 'bg-muted'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

export default function PaymentsClient({
  payments,
  summary,
  packs,
  classCount,
  token,
  serverNowMs,
}: {
  payments: Payment[]
  summary: MonthPaymentSummary
  packs: Pack[]
  classCount: { count: number; limit: number | null }
  token: string
  serverNowMs: number
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  // Inicializar desde `serverNowMs` para que SSR e hidratación coincidan.
  const [nowMs, setNowMs] = useState<number>(serverNowMs)
  useEffect(() => {
    setNowMs(Date.now())
  }, [])

  const currentMonth = summary.month
  const nextMonth = nextMonthOf(currentMonth)
  const effective = summary.effectivePack
  const effRank = packRank(effective)

  const pendingThisMonth = summary.payments.filter((p) => p.status === 'pending')
  const pendingPack = pendingThisMonth[0]?.pack ?? null

  const nextMonthPayments = payments.filter((p) => p.month === nextMonth)
  const nextMonthPaid = nextMonthPayments.find((p) => p.status === 'paid')?.pack ?? null
  const nextMonthPending = nextMonthPayments.find((p) => p.status === 'pending') ?? null

  async function handleInitiateAndPay(packId: string, month?: string) {
    const key = month ? `pack-${month}-${packId}` : `pack-${packId}`
    setLoading(key)
    try {
      const payment = await paymentsApi.initiate(packId, token, month)
      const { checkoutUrl } = await paymentsApi.checkout(payment.id, token)
      window.location.href = checkoutUrl
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al iniciar el pago')
      setLoading(null)
    }
  }

  async function handleResumePay(paymentId: string) {
    setLoading(`pay-${paymentId}`)
    try {
      const { checkoutUrl } = await paymentsApi.checkout(paymentId, token)
      window.location.href = checkoutUrl
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al iniciar el pago')
      setLoading(null)
    }
  }

  async function handleVerify(paymentId: string) {
    setLoading(`verify-${paymentId}`)
    try {
      const updated = await paymentsApi.verify(paymentId, token)
      if (updated.status === 'paid') {
        toast.success('¡Pago verificado y confirmado!')
      } else {
        toast.info('El pago todavía no fue acreditado')
      }
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al verificar')
    } finally {
      setLoading(null)
    }
  }

  async function handleChangePackPaid(
    newPackId: string,
    newPackName: string,
    moneyCredit: number,
    classCredit: number,
  ) {
    const within15 = isWithin15DaysOfMonthEnd(currentMonth, Date.now())
    const willBeClassCredit = within15 && classCredit > 0
    const targetMonth = nextMonthOf(currentMonth)
    const targetLabel = formatMonth(targetMonth)
    const msg = willBeClassCredit
      ? `¿Cambiar tu pack a "${newPackName}"? Te quedan ${classCredit} ${
          classCredit === 1 ? 'clase' : 'clases'
        } como crédito para ${targetLabel}.`
      : `¿Cambiar tu pack a "${newPackName}"? ${
          moneyCredit > 0
            ? `${ARS.format(moneyCredit)} quedan como crédito para tu próximo pago.`
            : 'No genera crédito.'
        }`
    if (!confirm(msg)) return
    setLoading(`change-${newPackId}`)
    try {
      const res = await paymentsApi.changePack(newPackId, token)
      if (res.creditType === 'classes' && res.creditAdded > 0) {
        toast.success(
          `Pack actualizado · ${res.creditAdded} ${
            res.creditAdded === 1 ? 'clase' : 'clases'
          } extra para ${formatMonth(res.creditTargetMonth ?? '')}`,
        )
      } else if (res.creditAdded > 0) {
        toast.success(`Pack actualizado · ${ARS.format(res.creditAdded)} de crédito sumado`)
      } else {
        toast.success('Pack actualizado')
      }
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cambiar el pack')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-4xl font-medium tracking-tight text-foreground">Mis pagos</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Elegí el pack que mejor te quede para el mes
        </p>
      </div>

      {/* Estado del mes actual */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            <span className="capitalize">{formatMonth(currentMonth)}</span>
            {effective ? (
              <Badge variant="default" className="ml-auto">
                {effective.name}
              </Badge>
            ) : (
              <Badge variant="secondary" className="ml-auto">
                Sin pack
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ClassUsage count={classCount.count} limit={classCount.limit} />
          {summary.totalPaid > 0 && (
            <p className="text-xs text-muted-foreground">
              Pagado este mes: {ARS.format(summary.totalPaid)}
            </p>
          )}
          {summary.userCredit > 0 && (
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">
              Tenés {ARS.format(summary.userCredit)} de crédito disponible — se descuenta automáticamente en tu próximo pago.
            </p>
          )}
          {summary.userClassCredit > 0 && summary.userClassCreditMonth && (
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg capitalize">
              Tenés {summary.userClassCredit} {summary.userClassCredit === 1 ? 'clase' : 'clases'} extra para {formatMonth(summary.userClassCreditMonth)} — se suman al cap de ese mes.
            </p>
          )}
          {effective &&
            classCount.limit !== null &&
            classCount.count >= classCount.limit && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                Usaste todas las clases de tu pack. Podés upgradear más abajo para
                sumar más este mes.
              </p>
            )}
        </CardContent>
      </Card>

      {/* Pagos pendientes (sin completar checkout) */}
      {pendingThisMonth.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Pagos pendientes
          </h2>
          {pendingThisMonth.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-center gap-3 py-4">
                <Clock className="h-5 w-5 text-amber-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {p.pack?.name ?? 'Pago'} — {ARS.format(Number(p.amount ?? 0))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pendiente de pago
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleResumePay(p.id)}
                    disabled={loading === `pay-${p.id}`}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Pagar
                  </Button>
                  {p.mpPreferenceId && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleVerify(p.id)}
                      disabled={loading === `verify-${p.id}`}
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${
                          loading === `verify-${p.id}` ? 'animate-spin' : ''
                        }`}
                      />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {/* Packs disponibles */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          {effective
            ? 'Cambiar de pack'
            : pendingPack
              ? 'Cambiar pack pendiente'
              : 'Packs disponibles'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {packs.map((p) => {
            const rank = packRank(p)
            const isCurrent = effective?.id === p.id
            const isPending = !effective && pendingPack?.id === p.id
            const isLowerOrEqual = effective !== null && rank <= effRank
            const delta = effective
              ? Math.max(0, Number(p.price) - summary.totalPaid)
              : Number(p.price)

            if (isCurrent) {
              return (
                <Card key={p.id} className="border-primary">
                  <CardContent className="py-4 space-y-2">
                    <div className="flex items-center gap-2">
                      {p.classCount === null ? (
                        <InfinityIcon className="h-4 w-4 text-primary" />
                      ) : (
                        <Package className="h-4 w-4 text-primary" />
                      )}
                      <p className="text-sm font-medium">{p.name}</p>
                      <Badge variant="default" className="ml-auto">
                        Tu pack
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.classCount === null
                        ? 'Clases ilimitadas'
                        : `${p.classCount} clases / mes`}
                    </p>
                  </CardContent>
                </Card>
              )
            }

            // Downgrade desde pago confirmado: mostrar como "Cambiar a este" con crédito
            if (isLowerOrEqual) {
              const moneyCredit = Math.max(0, summary.totalPaid - Number(p.price))
              const within15 = isWithin15DaysOfMonthEnd(currentMonth, nowMs)
              const bothFinite =
                effective?.classCount !== null && effective !== null &&
                p.classCount !== null
              const classCredit = bothFinite
                ? Math.max(0, (effective!.classCount as number) - (p.classCount as number))
                : 0
              const showClassCredit = within15 && classCredit > 0
              return (
                <Card key={p.id} className="border-dashed">
                  <CardContent className="py-4 space-y-3">
                    <div className="flex items-center gap-2">
                      {p.classCount === null ? (
                        <InfinityIcon className="h-4 w-4 text-primary" />
                      ) : (
                        <Package className="h-4 w-4 text-primary" />
                      )}
                      <p className="text-sm font-medium">{p.name}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.classCount === null
                        ? 'Clases ilimitadas'
                        : `${p.classCount} clases / mes`}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        {showClassCredit ? (
                          <p className="text-xs text-emerald-700">
                            +{classCredit} {classCredit === 1 ? 'clase' : 'clases'} para {formatMonth(nextMonthOf(currentMonth))}
                          </p>
                        ) : moneyCredit > 0 ? (
                          <p className="text-xs text-emerald-700">
                            +{ARS.format(moneyCredit)} de crédito
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Sin crédito extra</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleChangePackPaid(p.id, p.name, moneyCredit, classCredit)
                        }
                        disabled={loading === `change-${p.id}`}
                      >
                        Bajar a este
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            }

            return (
              <Card key={p.id} className={isPending ? 'border-amber-500/50' : ''}>
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-center gap-2">
                    {p.classCount === null ? (
                      <InfinityIcon className="h-4 w-4 text-primary" />
                    ) : (
                      <Package className="h-4 w-4 text-primary" />
                    )}
                    <p className="text-sm font-medium">{p.name}</p>
                    {isPending && (
                      <Badge variant="secondary" className="ml-auto">
                        Pendiente
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.classCount === null
                      ? 'Clases ilimitadas'
                      : `${p.classCount} clases / mes`}
                  </p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-semibold">{ARS.format(delta)}</p>
                      {effective && (
                        <p className="text-[10px] text-muted-foreground">
                          Upgrade · precio total {ARS.format(Number(p.price))}
                        </p>
                      )}
                      {!effective && summary.userCredit > 0 && delta > 0 && (
                        <p className="text-[10px] text-emerald-700">
                          Crédito disponible: {ARS.format(summary.userCredit)}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={pendingPack && !isPending ? 'outline' : 'default'}
                      onClick={() => handleInitiateAndPay(p.id)}
                      disabled={loading === `pack-${p.id}`}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      {isPending
                        ? 'Pagar'
                        : effective
                          ? 'Upgradear'
                          : pendingPack
                            ? 'Cambiar a este'
                            : 'Contratar'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
        {effective && packRank(effective) === Number.POSITIVE_INFINITY && (
          <p className="text-xs text-muted-foreground">
            Ya tenés el pack más alto disponible este mes.
          </p>
        )}
        {pendingPack && !effective && (
          <p className="text-xs text-muted-foreground">
            Cambiar de pack cancela el anterior pendiente automáticamente.
          </p>
        )}
      </section>

      {/* Pagar por adelantado el próximo mes */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide capitalize">
          Adelantar pago — {formatMonth(nextMonth)}
        </h2>
        {nextMonthPaid ? (
          <Card className="border-primary">
            <CardContent className="py-4 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">{nextMonthPaid.name} pago</p>
                <p className="text-xs text-muted-foreground">
                  Tu pack del próximo mes ya está confirmado.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {packs.map((p) => {
                const isPendingNext = nextMonthPending?.pack?.id === p.id
                const loadKey = `pack-${nextMonth}-${p.id}`
                return (
                  <Card
                    key={p.id}
                    className={isPendingNext ? 'border-amber-500/50' : ''}
                  >
                    <CardContent className="py-4 space-y-3">
                      <div className="flex items-center gap-2">
                        {p.classCount === null ? (
                          <InfinityIcon className="h-4 w-4 text-primary" />
                        ) : (
                          <Package className="h-4 w-4 text-primary" />
                        )}
                        <p className="text-sm font-medium">{p.name}</p>
                        {isPendingNext && (
                          <Badge variant="secondary" className="ml-auto">
                            Pendiente
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {p.classCount === null
                          ? 'Clases ilimitadas'
                          : `${p.classCount} clases / mes`}
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="text-lg font-semibold">
                          {ARS.format(Number(p.price))}
                        </p>
                        <Button
                          size="sm"
                          variant={
                            nextMonthPending && !isPendingNext ? 'outline' : 'default'
                          }
                          onClick={() => handleInitiateAndPay(p.id, nextMonth)}
                          disabled={loading === loadKey}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          {isPendingNext
                            ? 'Pagar'
                            : nextMonthPending
                              ? 'Cambiar a este'
                              : 'Adelantar'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Cuando pagues, se activan automáticamente tus reservas fijas para ese mes.
            </p>
          </>
        )}
      </section>

      {/* Historial */}
      {payments.filter((p) => p.month !== currentMonth).length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Historial
          </h2>
          {payments
            .filter((p) => p.month !== currentMonth)
            .map((p) => {
              const cfg = STATUS_CONFIG[p.status]
              const Icon = cfg.icon
              return (
                <Card key={p.id}>
                  <CardContent className="flex items-center gap-3 py-4">
                    <Icon className={`h-5 w-5 shrink-0 ${cfg.className}`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium capitalize">
                        {formatMonth(p.month)}
                        {p.pack && (
                          <span className="text-muted-foreground font-normal">
                            {' '}
                            · {p.pack.name}
                          </span>
                        )}
                      </p>
                      {p.paidAt && (
                        <p className="text-xs text-muted-foreground">
                          Pagado el {new Date(p.paidAt).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })} · {ARS.format(Number(p.amount ?? 0))}
                        </p>
                      )}
                    </div>
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                  </CardContent>
                </Card>
              )
            })}
        </section>
      )}
    </div>
  )
}
