import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { authApi } from '@/lib/api'
import Sidebar from '@/components/sidebar'
import BottomNav from '@/components/bottom-nav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  // /auth/me trae el User completo (incluye `level`) para mostrar la medalla en el sidebar.
  const me = await authApi.me(session.token).catch(() => null)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={session.user} level={me?.level ?? null} token={session.token} />
      <main className="flex-1 overflow-y-auto bg-background p-4 sm:p-6 lg:p-8 pb-24 md:pb-6 lg:pb-8">
        {children}
      </main>
      <BottomNav role={session.user.role} />
    </div>
  )
}
