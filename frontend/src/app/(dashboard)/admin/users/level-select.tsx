'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { usersApi } from '@/lib/api'
import type { ClassLevel } from '@/lib/definitions'

const LEVELS: { value: ClassLevel; label: string }[] = [
  { value: 'principiante', label: 'Principiante' },
  { value: 'intermedio', label: 'Intermedio' },
  { value: 'avanzado', label: 'Avanzado' },
  { value: 'abierto', label: 'Sin restricción' },
]

export default function LevelSelect({
  userId,
  current,
  token,
}: {
  userId: string
  current: ClassLevel
  token: string
}) {
  const [value, setValue] = useState<ClassLevel>(current ?? 'principiante')
  const [pending, setPending] = useState(false)

  async function handleChange(next: ClassLevel) {
    const prev = value
    setValue(next)
    setPending(true)
    try {
      await usersApi.update(userId, { level: next }, token)
      toast.success('Nivel actualizado')
    } catch (e: unknown) {
      setValue(prev)
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setPending(false)
    }
  }

  return (
    <select
      value={value}
      onChange={(e) => handleChange(e.target.value as ClassLevel)}
      disabled={pending}
      className="h-7 rounded-md border border-input bg-background px-2 text-xs"
      title="Nivel de la alumna"
    >
      {LEVELS.map((l) => (
        <option key={l.value} value={l.value}>{l.label}</option>
      ))}
    </select>
  )
}
