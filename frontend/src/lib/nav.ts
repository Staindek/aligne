import {
  CalendarDays,
  Users,
  BookOpen,
  ClipboardList,
  UserCircle,
  LayoutDashboard,
  CreditCard,
  Mail,
  BarChart3,
  Package,
} from 'lucide-react'
import { UserRole } from '@/lib/definitions'

export type NavItem = {
  href: string
  label: string
  shortLabel?: string
  icon: React.ElementType
}

export const NAV: Record<UserRole, NavItem[]> = {
  admin: [
    { href: '/admin', label: 'Inicio', icon: LayoutDashboard },
    { href: '/admin/schedules', label: 'Clases', icon: CalendarDays },
    { href: '/admin/instructors', label: 'Instructoras', shortLabel: 'Equipo', icon: UserCircle },
    { href: '/admin/classes', label: 'Modalidades', shortLabel: 'Tipos', icon: BookOpen },
    { href: '/admin/packs', label: 'Packs', icon: Package },
    { href: '/admin/users', label: 'Usuarixs', icon: Users },
    { href: '/admin/invitations', label: 'Invitaciones', shortLabel: 'Invitar', icon: Mail },
    { href: '/admin/payments', label: 'Pagos', icon: CreditCard },
    { href: '/admin/reports', label: 'Reportes', icon: BarChart3 },
  ],
  instructor: [
    { href: '/instructor', label: 'Inicio', icon: LayoutDashboard },
    { href: '/instructor/sessions', label: 'Mis sesiones', shortLabel: 'Sesiones', icon: CalendarDays },
    { href: '/instructor/students', label: 'Alumnxs', icon: Users },
  ],
  student: [
    { href: '/student', label: 'Inicio', icon: LayoutDashboard },
    { href: '/student/classes', label: 'Clases disponibles', shortLabel: 'Clases', icon: CalendarDays },
    { href: '/student/bookings', label: 'Mis reservas', shortLabel: 'Reservas', icon: ClipboardList },
    { href: '/student/payments', label: 'Mis pagos', shortLabel: 'Pagos', icon: CreditCard },
  ],
}

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin',
  instructor: 'Instructora',
  student: 'Alumnx',
}
