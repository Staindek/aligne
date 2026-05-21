'use server'
import { redirect } from 'next/navigation'
import { authApi } from '@/lib/api'
import { createSession, deleteSession } from '@/lib/session'
import { SessionUser } from '@/lib/definitions'

export async function loginAction(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  try {
    const { accessToken, user } = await authApi.login(email, password)
    const fullUser = await authApi.me(accessToken)

    const sessionUser: SessionUser = {
      id: fullUser.id,
      email: fullUser.email,
      role: fullUser.role,
      firstName: fullUser.firstName,
      lastName: fullUser.lastName,
    }

    await createSession(accessToken, sessionUser)
  } catch (e: unknown) {
    return e instanceof Error ? e.message : 'Error al iniciar sesión'
  }

  redirect('/')
}

export async function logoutAction(): Promise<void> {
  await deleteSession()
  redirect('/login')
}
