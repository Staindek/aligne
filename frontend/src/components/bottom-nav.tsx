'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MoreHorizontal } from 'lucide-react'
import { NAV } from '@/lib/nav'
import type { UserRole } from '@/lib/definitions'
import { cn } from '@/lib/utils'

const MAX_VISIBLE = 4

export default function BottomNav({ role }: { role: UserRole }) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const items = NAV[role] ?? []
  const hasOverflow = items.length > MAX_VISIBLE
  const visible = hasOverflow ? items.slice(0, MAX_VISIBLE - 1) : items
  const overflow = hasOverflow ? items.slice(MAX_VISIBLE - 1) : []
  const overflowActive = overflow.some((o) => o.href === pathname)
  const cols = visible.length + (hasOverflow ? 1 : 0)

  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-sidebar border-t border-sidebar-border pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegación principal"
    >
      {moreOpen && (
        <>
          <button
            type="button"
            aria-label="Cerrar menú"
            className="fixed inset-0 z-30 bg-black/20"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute bottom-full right-2 mb-2 z-40 rounded-lg border border-sidebar-border bg-sidebar shadow-lg p-1 min-w-[180px]">
            {overflow.map(({ href, label, icon: Icon }) => {
              const active = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md text-sm',
                    active
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              )
            })}
          </div>
        </>
      )}

      <ul
        className="grid"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {visible.map(({ href, label, shortLabel, icon: Icon }) => {
          const active = pathname === href
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] leading-none',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <Icon className={cn('h-5 w-5', active && 'stroke-[2.4]')} />
                <span className="truncate max-w-full px-1">{shortLabel ?? label}</span>
              </Link>
            </li>
          )
        })}
        {hasOverflow && (
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen((o) => !o)}
              aria-expanded={moreOpen}
              aria-label="Más opciones"
              className={cn(
                'w-full flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] leading-none',
                overflowActive || moreOpen ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span>Más</span>
            </button>
          </li>
        )}
      </ul>
    </nav>
  )
}
