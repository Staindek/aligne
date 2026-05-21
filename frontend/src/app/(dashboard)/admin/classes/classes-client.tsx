'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { classesApi } from '@/lib/api'
import type { PilatesClass, ClassLevel } from '@/lib/definitions'

const LEVEL_OPTIONS: { value: ClassLevel; label: string }[] = [
  { value: 'abierto', label: 'Abierto (cualquier nivel)' },
  { value: 'principiante', label: 'Principiante' },
  { value: 'intermedio', label: 'Intermedio' },
  { value: 'avanzado', label: 'Avanzado' },
]
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Trash2, Plus, BookOpen, Pencil, GripVertical } from 'lucide-react'

function ClassForm({
  token,
  initial,
  onDone,
}: {
  token: string
  initial?: PilatesClass
  onDone: () => void
}) {
  const [pending, setPending] = useState(false)
  const isEdit = !!initial

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    const fd = new FormData(e.currentTarget)
    const data = {
      name: fd.get('name'),
      description: fd.get('description') || undefined,
      durationMinutes: Number(fd.get('durationMinutes')),
      maxCapacity: Number(fd.get('maxCapacity')),
      level: fd.get('level'),
    }
    try {
      if (isEdit && initial) {
        await classesApi.update(initial.id, data, token)
        toast.success('Modalidad actualizada')
      } else {
        await classesApi.create(data, token)
        toast.success('Modalidad creada')
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
        <Input name="name" placeholder="Reformer Nivel 1" defaultValue={initial?.name} required />
      </div>
      <div className="space-y-1.5">
        <Label>Descripción</Label>
        <Textarea name="description" rows={2} defaultValue={initial?.description ?? ''} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Duración (min)</Label>
          <Input
            name="durationMinutes"
            type="number"
            defaultValue={initial?.durationMinutes ?? 60}
            min={15}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Capacidad máx.</Label>
          <Input
            name="maxCapacity"
            type="number"
            defaultValue={initial?.maxCapacity ?? 5}
            min={1}
            required
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Nivel</Label>
        <select
          name="level"
          defaultValue={initial?.level ?? 'abierto'}
          className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
        >
          {LEVEL_OPTIONS.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear modalidad'}
      </Button>
    </form>
  )
}

function SortableClassCard({
  c,
  onEdit,
  onRemove,
}: {
  c: PilatesClass
  onEdit: (c: PilatesClass) => void
  onRemove: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card>
        <CardContent className="flex items-center gap-4 py-4">
          <button
            type="button"
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
            aria-label="Reordenar"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-secondary shrink-0">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{c.name}</p>
            <p className="text-xs text-muted-foreground">{c.durationMinutes} min · máx {c.maxCapacity} alumnxs</p>
            {c.description && (
              <p className="text-xs text-muted-foreground/80 mt-0.5 line-clamp-1">{c.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="capitalize">{c.level ?? 'abierto'}</Badge>
            <Badge variant="secondary">{c.durationMinutes} min</Badge>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => onEdit(c)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => onRemove(c.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function ClassesClient({ classes, token }: { classes: PilatesClass[]; token: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PilatesClass | null>(null)
  const [items, setItems] = useState(classes)

  useEffect(() => setItems(classes), [classes])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function handleRemove(id: string) {
    if (!confirm('¿Desactivar esta modalidad?')) return
    try {
      await classesApi.remove(id, token)
      toast.success('Modalidad desactivada')
      router.refresh()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error') }
  }

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const reordered = arrayMove(items, oldIndex, newIndex)
    setItems(reordered)
    try {
      await classesApi.reorder(reordered.map((i) => i.id), token)
    } catch (e: unknown) {
      setItems(classes)
      toast.error(e instanceof Error ? e.message : 'Error al reordenar')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl font-medium tracking-tight text-foreground">Modalidades</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Administrá las modalidades del estudio</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm"><Plus className="h-4 w-4 mr-1" />Nueva</Button>} />
          <DialogContent>
            <DialogHeader><DialogTitle>Nueva modalidad</DialogTitle></DialogHeader>
            <ClassForm token={token} onDone={() => { setOpen(false); router.refresh() }} />
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No hay modalidades</CardContent></Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {items.map((c) => (
                <SortableClassCard key={c.id} c={c} onEdit={setEditing} onRemove={handleRemove} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar modalidad</DialogTitle></DialogHeader>
          {editing && (
            <ClassForm
              token={token}
              initial={editing}
              onDone={() => { setEditing(null); router.refresh() }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
