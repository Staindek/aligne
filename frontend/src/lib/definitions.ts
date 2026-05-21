export type UserRole = 'admin' | 'instructor' | 'student'
export type ClassLevel = 'principiante' | 'intermedio' | 'avanzado' | 'abierto'

export interface SessionUser {
  id: string
  email: string
  role: UserRole
  firstName: string
  lastName: string
}

export interface Session {
  token: string
  user: SessionUser
}

export interface ApiError {
  message: string | string[]
  statusCode: number
  error?: string
}

// Entidades del backend
export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  phone: string | null
  role: UserRole
  level: ClassLevel
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Instructor {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  bio: string | null
  specialty: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface PilatesClass {
  id: string
  name: string
  description: string | null
  durationMinutes: number
  maxCapacity: number
  level: ClassLevel
  displayOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Schedule {
  id: string
  pilatesClass: PilatesClass
  instructor: Instructor
  date: string
  startTime: string
  endTime: string
  maxCapacity: number
  enrolledCount: number
  isCancelled: boolean
  createdAt: string
  updatedAt: string
}

export type BookingStatus = 'confirmed' | 'cancelled' | 'waitlist' | 'pending_confirmation'
export type AttendanceStatus = 'pending' | 'present' | 'absent'

export interface Booking {
  id: string
  user: User
  schedule: Schedule
  status: BookingStatus
  cancelledAt: string | null
  confirmationDeadline: string | null
  attendanceStatus: AttendanceStatus
  attendanceMarkedAt: string | null
  waitlistPosition?: number
  waitlistTotal?: number
  recurringBooking?: { id: string } | null
  createdAt: string
  updatedAt: string
}

export type PaymentStatus = 'pending' | 'paid' | 'failed'

export interface Pack {
  id: string
  name: string
  classCount: number | null // null = ilimitado (Pase libre)
  price: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Payment {
  id: string
  user: User
  pack: Pack | null
  month: string
  status: PaymentStatus
  mpPaymentId: string | null
  mpPreferenceId: string | null
  amount: number | null
  paidAt: string | null
  createdAt: string
  updatedAt: string
}

export interface MonthPaymentSummary {
  month: string
  effectivePack: Pack | null
  classLimit: number | null // null = ilimitado, 0 = sin pack
  totalPaid: number
  userCredit: number // crédito acumulado del alumnx en pesos
  userClassCredit: number // crédito en clases para `userClassCreditMonth`
  userClassCreditMonth: string | null
  payments: Payment[]
}

export interface RecurringBooking {
  id: string
  user: User
  pilatesClass: PilatesClass
  dayOfWeek: number
  startTime: string
  isActive: boolean
  cancelledAt: string | null
  createdAt: string
  updatedAt: string
}

export type NotificationType =
  | 'payment_pending'
  | 'payment_confirmed'
  | 'class_created'
  | 'class_cancelled'
  | 'class_auto_cancelled'
  | 'spot_opened'
  | 'waitlist_promotion'
  | 'waitlist_expired'
  | 'fifth_class_warning'
  | 'no_show_warning'
  | 'materialization_pending'
  | 'materialization_auto_resolved'

export type ProposalStatus = 'pending' | 'resolved' | 'auto_resolved' | 'cancelled'

export interface ProposalCandidate {
  scheduleId: string
  recurringId: string
  priority: number
}

export interface MaterializationProposal {
  id: string
  user: User
  month: string
  status: ProposalStatus
  cap: number
  candidates: ProposalCandidate[]
  deadlineAt: string
  resolvedAt: string | null
  createdAt: string
}

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  body: string
  link: string | null
  isRead: boolean
  createdAt: string
}

export interface Invitation {
  id: string
  token: string
  email: string
  role: UserRole
  expiresAt: string
  usedAt: string | null
  createdAt: string
}

export interface InvitationPreview {
  email: string
  role: UserRole
  expiresAt: string
}

export interface ReportSummary {
  month: string
  income: { paidCount: number; total: number }
  classes: { scheduled: number; cancelled: number; completed: number }
  attendance: { present: number; absent: number; pending: number; rate: number }
  noShows: number
  topClasses: { name: string; bookings: number }[]
  topTimeslots: { startTime: string; bookings: number }[]
}
