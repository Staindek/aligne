'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logoutAction } from '@/actions/auth'
import { ClassLevel, SessionUser } from '@/lib/definitions'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import NotificationsBell from '@/components/notifications-bell'
import { LevelMedal, LEVEL_LABEL } from '@/components/level-medal'
import { NAV, ROLE_LABEL } from '@/lib/nav'
import { LogOut } from 'lucide-react'

export default function Sidebar({
  user,
  level,
  token,
}: {
  user: SessionUser
  level: ClassLevel | null
  token: string
}) {
  const pathname = usePathname()
  const links = NAV[user.role] ?? []
  const showLevel = user.role === 'student' && level !== null

  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-sidebar-border bg-sidebar">
      {/* Wordmark */}
      <div className="px-5 py-5 border-b border-sidebar-border">
        <span className="font-wordmark text-sidebar-foreground text-3xl font-light italic leading-none">
          Aligné
        </span>
        <p className="text-sidebar-foreground/50 text-[10px] tracking-[0.15em] uppercase mt-0.5 font-light">
          Estudio
        </p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
              pathname === href
                ? 'bg-primary text-primary-foreground font-medium'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Notifications + User + logout */}
      <div className="px-3 py-4 border-t border-sidebar-border space-y-1">
        <NotificationsBell token={token} />
        <div className="px-3 py-2">
          <p className="text-sm font-medium text-sidebar-foreground truncate">
            {user.firstName} {user.lastName}
          </p>
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <Badge variant="secondary" className="text-xs">
              {ROLE_LABEL[user.role]}
            </Badge>
            {showLevel && (
              <span
                className="inline-flex items-center gap-1 text-[11px] px-1.5 h-5 rounded-full bg-sidebar-accent/60 capitalize"
                title={`Nivel ${LEVEL_LABEL[level]}`}
              >
                <LevelMedal level={level} size="sm" />
                {LEVEL_LABEL[level]}
              </span>
            )}
          </div>
        </div>
        <form action={logoutAction}>
          <Button
            variant="ghost"
            size="sm"
            type="submit"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </form>
      </div>
    </aside>
  )
}
