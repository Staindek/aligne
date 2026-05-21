import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking, BookingStatus, AttendanceStatus } from '../bookings/entities/booking.entity';
import { Schedule } from '../schedules/entities/schedule.entity';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';

export interface ReportSummary {
  month: string;
  income: { paidCount: number; total: number };
  classes: { scheduled: number; cancelled: number; completed: number };
  attendance: { present: number; absent: number; pending: number; rate: number };
  noShows: number;
  topClasses: { name: string; bookings: number }[];
  topTimeslots: { startTime: string; bookings: number }[];
}

function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number);
  const start = `${month}-01`;
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const end = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
  return { start, end };
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Booking) private readonly bookingsRepo: Repository<Booking>,
    @InjectRepository(Schedule) private readonly schedulesRepo: Repository<Schedule>,
    @InjectRepository(Payment) private readonly paymentsRepo: Repository<Payment>,
  ) {}

  async summary(month: string): Promise<ReportSummary> {
    const { start, end } = monthRange(month);

    // Ingresos
    const paidPayments = await this.paymentsRepo.find({
      where: { month, status: PaymentStatus.PAID },
    });
    const income = {
      paidCount: paidPayments.length,
      total: paidPayments.reduce((acc, p) => acc + Number(p.amount ?? 0), 0),
    };

    // Clases del mes
    const schedules = await this.schedulesRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.pilatesClass', 'c')
      .where('s.date >= :start AND s.date < :end', { start, end })
      .getMany();
    const scheduled = schedules.length;
    const cancelled = schedules.filter((s) => s.isCancelled).length;
    const now = Date.now();
    const completed = schedules.filter((s) => {
      if (s.isCancelled) return false;
      const dt = new Date(`${s.date}T${s.startTime.substring(0, 5)}:00`);
      return dt.getTime() < now;
    }).length;

    // Asistencia
    const bookings = await this.bookingsRepo
      .createQueryBuilder('b')
      .innerJoin('b.schedule', 's')
      .where('s.date >= :start AND s.date < :end', { start, end })
      .andWhere('b.status = :st', { st: BookingStatus.CONFIRMED })
      .getMany();
    let present = 0,
      absent = 0,
      pending = 0;
    for (const b of bookings) {
      if (b.attendanceStatus === AttendanceStatus.PRESENT) present++;
      else if (b.attendanceStatus === AttendanceStatus.ABSENT) absent++;
      else pending++;
    }
    const marked = present + absent;
    const rate = marked === 0 ? 0 : Math.round((present / marked) * 100);

    // Top modalidades del mes (cuenta de reservas confirmed en clases del mes)
    const topClassesMap = new Map<string, number>();
    for (const s of schedules) {
      const name = s.pilatesClass?.name ?? '—';
      // pre-cuenta para evitar query extra por schedule; usamos enrolledCount como proxy
      topClassesMap.set(name, (topClassesMap.get(name) ?? 0) + s.enrolledCount);
    }
    const topClasses = Array.from(topClassesMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, bookings]) => ({ name, bookings }));

    // Top horarios del mes
    const topTimeslotsMap = new Map<string, number>();
    for (const s of schedules) {
      const t = s.startTime.substring(0, 5);
      topTimeslotsMap.set(t, (topTimeslotsMap.get(t) ?? 0) + s.enrolledCount);
    }
    const topTimeslots = Array.from(topTimeslotsMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([startTime, bookings]) => ({ startTime, bookings }));

    return {
      month,
      income,
      classes: { scheduled, cancelled, completed },
      attendance: { present, absent, pending, rate },
      noShows: absent,
      topClasses,
      topTimeslots,
    };
  }
}
