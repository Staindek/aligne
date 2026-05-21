import { Repository } from 'typeorm';
import { Booking, BookingStatus } from './entities/booking.entity';

/**
 * Chequea si la alumna tiene otra reserva activa que se solape en el tiempo
 * con el rango [startTime, endTime) en la misma fecha. Clases consecutivas
 * (10-11 y 11-12) NO se consideran solape.
 */
export async function hasTimeConflict(
  bookingsRepo: Repository<Booking>,
  userId: string,
  date: string,
  startTime: string,
  endTime: string,
): Promise<boolean> {
  const count = await bookingsRepo
    .createQueryBuilder('b')
    .innerJoin('b.schedule', 's')
    .where('b.user.id = :userId', { userId })
    .andWhere('s.date = :date', { date })
    .andWhere('s.isCancelled = false')
    .andWhere('b.status IN (:...statuses)', {
      statuses: [
        BookingStatus.CONFIRMED,
        BookingStatus.PENDING_CONFIRMATION,
        BookingStatus.WAITLIST,
      ],
    })
    .andWhere('s.startTime < :endTime AND s.endTime > :startTime', {
      startTime,
      endTime,
    })
    .getCount();
  return count > 0;
}
