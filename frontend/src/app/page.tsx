import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'

export default async function Home() {
  const session = await getSession()
  if (!session) redirect('/login')

  const roleHome: Record<string, string> = {
    admin: '/admin',
    instructor: '/instructor',
    student: '/student',
  }
  redirect(roleHome[session.user.role] ?? '/login')
}
