const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, ...init } = options
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Error desconocido' }))
    throw new Error(
      Array.isArray(err.message) ? err.message.join(', ') : err.message,
    )
  }

  // 204 No Content
  if (res.status === 204) return undefined as T
  return res.json()
}

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    request<{ accessToken: string; user: { id: string; email: string; role: string } }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
    ),
  register: (data: object) =>
    request<{ accessToken: string; user: { id: string; email: string; role: string } }>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify(data) },
    ),
  me: (token: string) =>
    request<import('./definitions').User>('/auth/me', { token }),
  forgotPassword: (email: string) =>
    request<{ message: string; resetToken?: string }>(
      '/auth/forgot-password',
      { method: 'POST', body: JSON.stringify({ email }) },
    ),
  resetPassword: (token: string, newPassword: string) =>
    request<void>(
      '/auth/reset-password',
      { method: 'POST', body: JSON.stringify({ token, newPassword }) },
    ),
}

// Users
export const usersApi = {
  list: (token: string) =>
    request<import('./definitions').User[]>('/users', { token }),
  get: (id: string, token: string) =>
    request<import('./definitions').User>(`/users/${id}`, { token }),
  create: (data: object, token: string) =>
    request<import('./definitions').User>('/users', {
      method: 'POST', body: JSON.stringify(data), token,
    }),
  update: (id: string, data: object, token: string) =>
    request<import('./definitions').User>(`/users/${id}`, {
      method: 'PATCH', body: JSON.stringify(data), token,
    }),
  remove: (id: string, token: string) =>
    request<void>(`/users/${id}`, { method: 'DELETE', token }),
}

// Instructors
export const instructorsApi = {
  list: (token: string) =>
    request<import('./definitions').Instructor[]>('/instructors', { token }),
  get: (id: string, token: string) =>
    request<import('./definitions').Instructor>(`/instructors/${id}`, { token }),
  create: (data: object, token: string) =>
    request<import('./definitions').Instructor>('/instructors', {
      method: 'POST', body: JSON.stringify(data), token,
    }),
  update: (id: string, data: object, token: string) =>
    request<import('./definitions').Instructor>(`/instructors/${id}`, {
      method: 'PATCH', body: JSON.stringify(data), token,
    }),
  remove: (id: string, token: string) =>
    request<void>(`/instructors/${id}`, { method: 'DELETE', token }),
}

// Classes
export const classesApi = {
  list: (token: string) =>
    request<import('./definitions').PilatesClass[]>('/classes', { token }),
  create: (data: object, token: string) =>
    request<import('./definitions').PilatesClass>('/classes', {
      method: 'POST', body: JSON.stringify(data), token,
    }),
  update: (id: string, data: object, token: string) =>
    request<import('./definitions').PilatesClass>(`/classes/${id}`, {
      method: 'PATCH', body: JSON.stringify(data), token,
    }),
  remove: (id: string, token: string) =>
    request<void>(`/classes/${id}`, { method: 'DELETE', token }),
  reorder: (ids: string[], token: string) =>
    request<import('./definitions').PilatesClass[]>('/classes/reorder', {
      method: 'POST', body: JSON.stringify({ ids }), token,
    }),
}

// Schedules
export const schedulesApi = {
  list: (token: string, date?: string) =>
    request<import('./definitions').Schedule[]>(
      date ? `/schedules?date=${date}` : '/schedules',
      { token },
    ),
  get: (id: string, token: string) =>
    request<import('./definitions').Schedule>(`/schedules/${id}`, { token }),
  create: (data: object, token: string) =>
    request<import('./definitions').Schedule>('/schedules', {
      method: 'POST', body: JSON.stringify(data), token,
    }),
  bulkCreate: (data: object, token: string) =>
    request<{
      created: import('./definitions').Schedule[]
      skipped: { date: string; reason: string }[]
    }>('/schedules/bulk', {
      method: 'POST', body: JSON.stringify(data), token,
    }),
  generateMonth: (token: string, month?: string) =>
    request<{
      created: import('./definitions').Schedule[]
      skipped: { date: string; reason: string }[]
    }>('/schedules/generate-month', {
      method: 'POST', body: JSON.stringify(month ? { month } : {}), token,
    }),
  update: (id: string, data: object, token: string) =>
    request<import('./definitions').Schedule>(`/schedules/${id}`, {
      method: 'PATCH', body: JSON.stringify(data), token,
    }),
  cancel: (id: string, token: string) =>
    request<import('./definitions').Schedule>(`/schedules/${id}`, {
      method: 'DELETE', token,
    }),
}

// Payments
export const paymentsApi = {
  myPayments: (token: string) =>
    request<import('./definitions').Payment[]>('/payments/my', { token }),
  currentMonth: (token: string) =>
    request<import('./definitions').MonthPaymentSummary>('/payments/current', { token }),
  initiate: (packId: string, token: string, month?: string) =>
    request<import('./definitions').Payment>('/payments/initiate', {
      method: 'POST',
      body: JSON.stringify(month ? { packId, month } : { packId }),
      token,
    }),
  checkout: (paymentId: string, token: string) =>
    request<{ checkoutUrl: string }>(`/payments/${paymentId}/checkout`, {
      method: 'POST', token,
    }),
  verify: (paymentId: string, token: string) =>
    request<import('./definitions').Payment>(`/payments/${paymentId}/verify`, {
      method: 'POST', token,
    }),
  changePack: (newPackId: string, token: string, month?: string) =>
    request<{
      payment: import('./definitions').Payment
      creditType: 'money' | 'classes'
      creditAdded: number
      creditTargetMonth: string | null
      userCredit: number
      userClassCredit: number
      userClassCreditMonth: string | null
    }>('/payments/change-pack', {
      method: 'POST',
      body: JSON.stringify(month ? { newPackId, month } : { newPackId }),
      token,
    }),
  adminList: (token: string) =>
    request<import('./definitions').Payment[]>('/payments', { token }),
  adminMarkPaid: (id: string, token: string) =>
    request<import('./definitions').Payment>(`/payments/${id}/paid`, {
      method: 'PATCH', token,
    }),
  adminChangePack: (userId: string, newPackId: string, token: string, month?: string) =>
    request<{
      payment: import('./definitions').Payment
      creditType: 'money' | 'classes'
      creditAdded: number
      creditTargetMonth: string | null
      userCredit: number
      userClassCredit: number
      userClassCreditMonth: string | null
    }>('/payments/admin/change-pack', {
      method: 'POST',
      body: JSON.stringify(month ? { userId, newPackId, month } : { userId, newPackId }),
      token,
    }),
}

// Packs
export const packsApi = {
  list: (token: string, includeInactive = false) =>
    request<import('./definitions').Pack[]>(
      includeInactive ? '/packs?includeInactive=true' : '/packs',
      { token },
    ),
  create: (data: object, token: string) =>
    request<import('./definitions').Pack>('/packs', {
      method: 'POST', body: JSON.stringify(data), token,
    }),
  update: (id: string, data: object, token: string) =>
    request<import('./definitions').Pack>(`/packs/${id}`, {
      method: 'PATCH', body: JSON.stringify(data), token,
    }),
  remove: (id: string, token: string) =>
    request<void>(`/packs/${id}`, { method: 'DELETE', token }),
}

// Bookings
export const bookingsApi = {
  myBookings: (token: string) =>
    request<import('./definitions').Booking[]>('/bookings/my', { token }),
  myClassCount: (token: string, month?: string) =>
    request<{ count: number; limit: number | null }>(
      month ? `/bookings/my/class-count?month=${month}` : '/bookings/my/class-count',
      { token },
    ),
  bySchedule: (scheduleId: string, token: string) =>
    request<import('./definitions').Booking[]>(
      `/bookings/schedule/${scheduleId}`, { token },
    ),
  bySchedules: (ids: string[], token: string) =>
    request<Record<string, import('./definitions').Booking[]>>(
      '/bookings/by-schedules',
      { method: 'POST', body: JSON.stringify({ ids }), token },
    ),
  create: (scheduleId: string, token: string) =>
    request<import('./definitions').Booking>('/bookings', {
      method: 'POST', body: JSON.stringify({ scheduleId }), token,
    }),
  confirm: (id: string, token: string) =>
    request<import('./definitions').Booking>(`/bookings/${id}/confirm`, {
      method: 'POST', token,
    }),
  cancel: (id: string, token: string) =>
    request<import('./definitions').Booking>(`/bookings/${id}`, {
      method: 'DELETE', token,
    }),
  userClassCount: (userId: string, token: string, month?: string) =>
    request<{ count: number; limit: number | null }>(
      month ? `/bookings/user/${userId}/class-count?month=${month}` : `/bookings/user/${userId}/class-count`,
      { token },
    ),
  markAttendance: (id: string, status: import('./definitions').AttendanceStatus, token: string) =>
    request<import('./definitions').Booking>(`/bookings/${id}/attendance`, {
      method: 'PATCH', body: JSON.stringify({ status }), token,
    }),
  userNoShowCount: (userId: string, token: string, month?: string) =>
    request<{ count: number }>(
      month ? `/bookings/user/${userId}/no-show-count?month=${month}` : `/bookings/user/${userId}/no-show-count`,
      { token },
    ),
}

// Recurring bookings
export const recurringBookingsApi = {
  myActive: (token: string) =>
    request<import('./definitions').RecurringBooking[]>('/bookings/recurring/my', { token }),
  create: (scheduleId: string, token: string) =>
    request<{
      recurring: import('./definitions').RecurringBooking
      materializedCount: number
      skippedCount: number
    }>('/bookings/recurring', {
      method: 'POST', body: JSON.stringify({ scheduleId }), token,
    }),
  cancel: (id: string, token: string) =>
    request<{
      recurring: import('./definitions').RecurringBooking
      cancelledCount: number
    }>(`/bookings/recurring/${id}`, { method: 'DELETE', token }),
}

// Materialization proposals (elegir fijas cuando exceden el cap)
export const proposalsApi = {
  pending: (token: string) =>
    request<import('./definitions').MaterializationProposal[]>(
      '/bookings/recurring/proposals/pending',
      { token },
    ),
  get: (id: string, token: string) =>
    request<{
      proposal: import('./definitions').MaterializationProposal
      schedules: import('./definitions').Schedule[]
    }>(`/bookings/recurring/proposals/${id}`, { token }),
  resolve: (id: string, selectedScheduleIds: string[], token: string) =>
    request<{
      proposal: import('./definitions').MaterializationProposal
      materialized: number
    }>(`/bookings/recurring/proposals/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ selectedScheduleIds }),
      token,
    }),
}

// Reports
export const reportsApi = {
  summary: (token: string, month?: string) =>
    request<import('./definitions').ReportSummary>(
      month ? `/reports/summary?month=${month}` : '/reports/summary',
      { token },
    ),
}

// Invitations
export const invitationsApi = {
  byToken: (token: string) =>
    request<import('./definitions').InvitationPreview>(`/invitations/by-token/${token}`),
  create: (data: { email: string; role: string }, token: string) =>
    request<import('./definitions').Invitation>('/invitations', {
      method: 'POST', body: JSON.stringify(data), token,
    }),
  list: (token: string) =>
    request<import('./definitions').Invitation[]>('/invitations', { token }),
  pending: (token: string) =>
    request<import('./definitions').Invitation[]>('/invitations/pending', { token }),
  revoke: (id: string, token: string) =>
    request<{ ok: true }>(`/invitations/${id}`, { method: 'DELETE', token }),
}

// Notifications
export const notificationsApi = {
  list: (token: string) =>
    request<import('./definitions').AppNotification[]>('/notifications/my', { token }),
  unreadCount: (token: string) =>
    request<{ count: number }>('/notifications/unread-count', { token }),
  markRead: (id: string, token: string) =>
    request<{ ok: true }>(`/notifications/${id}/read`, { method: 'PATCH', token }),
  markAllRead: (token: string) =>
    request<{ ok: true }>('/notifications/read-all', { method: 'POST', token }),
}
