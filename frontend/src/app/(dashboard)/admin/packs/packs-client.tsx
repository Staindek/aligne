'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { packsApi } from '@/lib/api'
import type { Pack } from '@/lib/definitions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Trash2, Plus, Package, Pencil, Infinity as InfinityIcon } from 'lucide-react'

const ARS = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

function PackForm({
  token,
  initial,
  onDone,
}: {
  token: string
  initial?: Pack
  onDone: () => void
}) {
  const [pending, setPending] = useState(false)
  const [unlimited, setUnlimited] = useState(
    initial ? initial.classCount === null : false,
  )
  const isEdit = !!initial

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    const fd = new FormData(e.currentTarget)
    const classCountRaw = fd.get('classCount')
    const data: Record<string, unknown> = {
      name: fd.get('name'),
      price: Number(fd.get('price')),
      classCount: unlimited ? null : Number(classCountRaw),
      isActive: fd.get('isActive') === 'on',
    }
    try {
      if (isEdit && initial) {
        await packsApi.update(initial.id, data, token)
        toast.success('Pack actualizado')
      } else {
        await packsApi.create(data, token)
        toast.success('Pack creado')
      }
      onDone()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <Label>Nombre</Label>
        <Input name="name" placeholder="Pack 4 clases" defaultValue={initial?.name} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Clases / mes</Label>
          <Input
            name="classCount"
            type="number"
            min={1}
            defaultValue={initial?.classCount ?? ''}
            disabled={unlimited}
            required={!unlimited}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Precio (ARS)</Label>
          <Input
            name="price"
            type="number"
            min={0}
            defaultValue={initial?.price ?? 0}
            required
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground select-none">
        <input
          type="checkbox"
          checked={unlimited}
          onChange={(e) => setUnlimited(e.target.checked)}
        />
        Pase libre (sin límite mensual)
      </label>
      <label className="flex items-center gap-2 text-sm text-muted-foreground select-none">
        <input
          name="isActive"
          type="checkbox"
          defaultChecked={initial?.isActive ?? true}
        />
        Activo (visible para alumnxs)
      </label>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear pack'}
      </Button>
    </form>
  )
}

export default function PacksClient({
  packs,
  token,
}: {
  packs: Pack[]
  token: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Pack | null>(null)

  async function handleRemove(id: string) {
    if (!confirm('¿Desactivar este pack? Dejará de estar disponible para alumnxs.')) return
    try {
      await packsApi.remove(id, token)
      toast.success('Pack desactivado')
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl font-medium tracking-tight text-foreground">Packs</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Planes mensuales que las alumnxs pueden contratar
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Nuevo
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo pack</DialogTitle>
            </DialogHeader>
            <PackForm
              token={token}
              onDone={() => {
                setOpen(false)
                router.refresh()
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {packs.length === 0 ? (
          <Card className="sm:col-span-2">
            <CardContent className="py-12 text-center text-muted-foreground">
              No hay packs configurados
            </CardContent>
          </Card>
        ) : (
          packs.map((p) => (
            <Card key={p.id} className={p.isActive ? '' : 'opacity-60'}>
              <CardContent className="py-4 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-secondary shrink-0">
                    {p.classCount === null ? (
                      <InfinityIcon className="h-5 w-5 text-primary" />
                    ) : (
                      <Package className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.classCount === null
                        ? 'Clases ilimitadas'
                        : `${p.classCount} clases / mes`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => setEditing(p)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemove(p.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-foreground">
                    {ARS.format(Number(p.price))}
                  </span>
                  <Badge variant={p.isActive ? 'secondary' : 'outline'}>
                    {p.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar pack</DialogTitle>
          </DialogHeader>
          {editing && (
            <PackForm
              token={token}
              initial={editing}
              onDone={() => {
                setEditing(null)
                router.refresh()
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
