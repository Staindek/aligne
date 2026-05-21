import { getSession } from '@/lib/session'
import { bookingsApi } from '@/lib/api'
import BookingsClient from './bookings-client'

export default async function StudentBookingsPage() {
  const session = (await getSession())!
  const bookings = await bookingsApi.myBookings(session.token).catch(() => [])
  return <BookingsClient bookings={bookings} token={session.token} serverNowMs={Date.now()} />
}
