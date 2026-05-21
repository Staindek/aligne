import { cn } from '@/lib/utils'
import type { ClassLevel } from '@/lib/definitions'

export const LEVEL_LABEL: Record<ClassLevel, string> = {
  principiante: 'principiante',
  intermedio: 'intermedio',
  avanzado: 'avanzado',
  abierto: 'abierto',
}

// Emojis: brote → capullo → flor. Abierto = hoja (todo nivel).
const LEVEL_EMOJI: Record<ClassLevel, string> = {
  principiante: '🌱',
  intermedio: '🌷',
  avanzado: '🌸',
  abierto: '🌿',
}

export const LEVEL_STRIPE_BG: Record<ClassLevel, string> = {
  principiante: 'bg-level-principiante',
  intermedio: 'bg-level-intermedio',
  avanzado: 'bg-level-avanzado',
  abierto: 'bg-level-abierto',
}

export const LEVEL_BORDER_COLOR: Record<ClassLevel, string> = {
  principiante: 'border-level-principiante/55',
  intermedio: 'border-level-intermedio/55',
  avanzado: 'border-level-avanzado/55',
  abierto: 'border-level-abierto/45',
}

export function LevelMedal({
  level,
  size = 'md',
  withLabel = false,
  className,
  title,
}: {
  level: ClassLevel
  size?: 'sm' | 'md' | 'lg'
  withLabel?: boolean
  className?: string
  title?: string
}) {
  const sizeClass = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-xl' : 'text-lg'
  return (
    <span
      className={cn('inline-flex items-center gap-1', className)}
      title={title ?? `Nivel ${LEVEL_LABEL[level]}`}
      aria-label={`Nivel ${LEVEL_LABEL[level]}`}
    >
      <span className={cn(sizeClass, 'leading-none')} role="img" aria-hidden="true">
        {LEVEL_EMOJI[level]}
      </span>
      {withLabel && (
        <span className="text-[11px] font-medium capitalize">{LEVEL_LABEL[level]}</span>
      )}
    </span>
  )
}
