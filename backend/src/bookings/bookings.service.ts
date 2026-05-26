import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import {
  Booking,
  BookingStatus,
  AttendanceStatus,
} from './entities/booking.entity';
import { Schedule } from '../schedules/entities/schedule.entity';
import { SchedulesService } from '../schedules/schedules.service';
import { User, UserRole } from '../users/entities/user.entity';
import { canTakeLevel } from '../common/enums/level.enum';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { hasTimeConflict } from './booking-overlap.helper';

const CONFIRMATION_HOURS = 1; // horas para confirmar después de ser promovida
const WAITLIST_MIN_HOURS = 3; // no promover lista de espera si faltan menos de N hs
const NO_SHOW_WARNING_THRESHOLD = 3; // disparar aviso al llegar a N faltas en el mes

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
    @InjectRepository(Schedule)
    private readonly schedulesRepository: Repository<Schedule>,
    @Inject(forwardRef(() => SchedulesService))
    private readonly schedulesService: SchedulesService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  private getScheduleStart(schedule: Schedule): Date {
    const time = schedule.startTime.substring(0, 5);
    return new Date(`${schedule.date}T${time}:00`);
  }

  private assertBookingDeadline(schedule: Schedule): void {
    const start = this.getScheduleStart(schedule);
    if (start.getTime() <= Date.now())
      throw new BadRequestException('La sesión ya empezó');
  }

  private assertCancelDeadline(schedule: Schedule): void {
    const start = this.getScheduleStart(schedule);
    const diffHours = (start.getTime() - Date.now()) / 36e5;
    if (diffHours < 4)
      throw new BadRequestException(
        'No se puede cancelar con menos de 4 horas de anticipación',
      );
  }

  private currentMonth(): string {
    return new Date().toISOString().substring(0, 7);
  }

  private scheduleMonth(schedule: Schedule): string {
    return schedule.date.substring(0, 7);
  }

  private monthRange(month: string): { start: string; end: string } {
    const [y, m] = month.split('-').map(Number);
    const start = `${month}-01`;
    const nextY = m === 12 ? y + 1 : y;
    const nextM = m === 12 ? 1 : m + 1;
    const end = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
    return { start, end };
  }

  private async countMonthBookings(
    userId: string,
    month: string,
  ): Promise<number> {
    const { start, end } = this.monthRange(month);
    return this.bookingsRepository
      .createQueryBuilder('b')
      .innerJoin('b.schedule', 's')
      .where('b.user.id = :userId', { userId })
      .andWhere('b.status IN (:...statuses)', {
        statuses: [BookingStatus.CONFIRMED, BookingStatus.PENDING_CONFIRMATION],
      })
      .andWhere('s.date >= :start AND s.date < :end', { start, end })
      .getCount();
  }

  async create(dto: CreateBookingDto, user: User): Promise<Booking> {
    const schedule = await this.schedulesService.findOne(dto.scheduleId);

    if (schedule.isCancelled)
      throw new BadRequestException('La sesión está cancelada');
    this.assertBookingDeadline(schedule);

    // Validar nivel: si la clase tiene nivel específico, la alumna tiene que tenerlo
    if (!canTakeLevel(user.level, schedule.pilatesClass.level)) {
      throw new ForbiddenException(
        `Esta clase es de nivel ${schedule.pilatesClass.level}. Hablá con el estudio si querés cambiar tu nivel.`,
      );
    }

    // Verificar pack del mes de la sesión y aplicar su límite
    const sessionMonth = this.scheduleMonth(schedule);
    const { hasPaid, cap } = await this.paymentsService.getMonthBookingCap(
      user.id,
      sessionMonth,
    );

    // Mes corriente: requiere pack PAID (confirmado por admin/MP) para reservar
    if (sessionMonth === this.currentMonth() && !hasPaid) {
      throw new ForbiddenException(
        'No tenés un pack confirmado este mes. Esperá la confirmación de admin para reservar.',
      );
    }

    // Mes futuro: requiere al menos un pack (PAID o PENDING) que defina cap
    if (cap === 0) {
      throw new ForbiddenException(
        'No tenés un pack para ese mes. Elegí y abonás un pack primero.',
      );
    }

    // Aplicar cap (cap !== null === finito)
    if (cap !== null && cap > 0) {
      const monthCount = await this.countMonthBookings(user.id, sessionMonth);
      if (monthCount >= cap) {
        void this.notifications.fifthClassWarning(
          user.id,
          user.email,
          user.firstName,
          sessionMonth,
        );
        throw new BadRequestException(
          hasPaid
            ? `Alcanzaste el límite de ${cap} clases de tu pack para este mes.`
            : `Alcanzaste el cupo de ${cap} clases del pack pendiente. Esperá la confirmación de admin para sumar más.`,
        );
      }
    }

    // Verificar duplicado
    const existing = await this.bookingsRepository.findOne({
      where: {
        user: { id: user.id },
        schedule: { id: schedule.id },
        status: BookingStatus.CONFIRMED,
      },
    });
    if (existing)
      throw new ConflictException('Ya tenés una reserva en esta sesión');

    // Sin dos clases en el mismo horario (consecutivas sí: 10-11 y 11-12 ok)
    const conflict = await hasTimeConflict(
      this.bookingsRepository,
      user.id,
      schedule.date,
      schedule.startTime,
      schedule.endTime,
    );
    if (conflict) {
      throw new ConflictException(
        'Ya tenés otra clase reservada en ese horario',
      );
    }

    const isFull = schedule.enrolledCount >= schedule.maxCapacity;
    const status = isFull ? BookingStatus.WAITLIST : BookingStatus.CONFIRMED;

    const booking = this.bookingsRepository.create({ user, schedule, status });
    const saved = await this.bookingsRepository.save(booking);

    if (!isFull) {
      await this.schedulesRepository.increment(
        { id: schedule.id },
        'enrolledCount',
        1,
      );
      // alguien volvió a anotarse → cancelar la cuenta atrás de auto-cancel
      await this.schedulesRepository.update(
        { id: schedule.id },
        { emptyAt: null },
      );
    }

    return saved;
  }

  async findMyBookings(userId: string): Promise<Booking[]> {
    return this.bookingsRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  async findMyBookingsWithWaitlistPosition(
    userId: string,
  ): Promise<
    (Booking & { waitlistPosition?: number; waitlistTotal?: number })[]
  > {
    const bookings = await this.findMyBookings(userId);

    const result = await Promise.all(
      bookings.map(async (b) => {
        if (b.status !== BookingStatus.WAITLIST) return b;
        const [position, total] = await Promise.all([
          this.getWaitlistPosition(b.id, b.schedule.id),
          this.getWaitlistTotal(b.schedule.id),
        ]);
        return Object.assign(b, {
          waitlistPosition: position,
          waitlistTotal: total,
        });
      }),
    );

    return result;
  }

  findBySchedule(scheduleId: string): Promise<Booking[]> {
    return this.bookingsRepository.find({
      where: { schedule: { id: scheduleId } },
      order: { createdAt: 'ASC' },
    });
  }

  async findBySchedules(
    scheduleIds: string[],
  ): Promise<Record<string, Booking[]>> {
    const grouped: Record<string, Booking[]> = Object.fromEntries(
      scheduleIds.map((id) => [id, []]),
    );
    if (scheduleIds.length === 0) return grouped;
    const bookings = await this.bookingsRepository.find({
      where: { schedule: { id: In(scheduleIds) } },
      order: { createdAt: 'ASC' },
    });
    for (const b of bookings) grouped[b.schedule.id]?.push(b);
    return grouped;
  }

  async cancel(id: string, user: User): Promise<Booking> {
    const booking = await this.bookingsRepository.findOne({
      where: { id, user: { id: user.id } },
      relations: ['schedule'],
    });
    if (!booking) throw new NotFoundException('Reserva no encontrada');
    if (booking.status === BookingStatus.CANCELLED)
      throw new BadRequestException('La reserva ya está cancelada');

    this.assertCancelDeadline(booking.schedule);

    const wasConfirmed =
      booking.status === BookingStatus.CONFIRMED ||
      booking.status === BookingStatus.PENDING_CONFIRMATION;

    booking.status = BookingStatus.CANCELLED;
    booking.cancelledAt = new Date();
    const saved = await this.bookingsRepository.save(booking);

    if (wasConfirmed) {
      await this.schedulesRepository.decrement(
        { id: booking.schedule.id },
        'enrolledCount',
        1,
      );
      const waitlistTotal = await this.getWaitlistTotal(booking.schedule.id);
      if (waitlistTotal > 0) {
        await this.promoteFromWaitlist(booking.schedule);
      } else {
        // Si la clase queda vacía, marcamos timestamp para que el cron la auto-cancele
        const fresh = await this.schedulesRepository.findOne({
          where: { id: booking.schedule.id },
        });
        if (fresh && fresh.enrolledCount === 0 && !fresh.emptyAt) {
          await this.schedulesRepository.update(
            { id: booking.schedule.id },
            { emptyAt: new Date() },
          );
        }
        void this.notifySpotOpened(booking.schedule);
      }
    }

    return saved;
  }

  private async notifySpotOpened(schedule: Schedule): Promise<void> {
    const scheduleStart = this.getScheduleStart(schedule);
    if (scheduleStart.getTime() <= Date.now()) return; // la clase ya empezó

    const month = schedule.date.substring(0, 7);
    const students = await this.paymentsService.findPaidStudentsForMonth(month);
    if (students.length === 0) return;

    const existing = await this.bookingsRepository.find({
      where: { schedule: { id: schedule.id } },
    });
    const blocked = new Set(
      existing
        .filter(
          (b) =>
            b.status === BookingStatus.CONFIRMED ||
            b.status === BookingStatus.PENDING_CONFIRMATION ||
            b.status === BookingStatus.WAITLIST,
        )
        .map((b) => b.user?.id),
    );

    const appUrl =
      this.config.get<string>('APP_URL') ?? 'http://localhost:3001';
    const bookUrl = `${appUrl}/student/classes`;
    const className = schedule.pilatesClass?.name ?? 'clase';
    const time = schedule.startTime.substring(0, 5);

    for (const u of students) {
      if (blocked.has(u.id)) continue;
      void this.notifications.spotOpened(
        u.id,
        u.email,
        u.firstName,
        className,
        schedule.date,
        time,
        bookUrl,
      );
    }
  }

  async confirmWaitlistPromotion(id: string, userId: string): Promise<Booking> {
    const booking = await this.bookingsRepository.findOne({
      where: {
        id,
        user: { id: userId },
        status: BookingStatus.PENDING_CONFIRMATION,
      },
      relations: ['schedule'],
    });
    if (!booking)
      throw new NotFoundException(
        'No hay confirmación pendiente para esta reserva',
      );

    if (
      booking.confirmationDeadline &&
      booking.confirmationDeadline < new Date()
    ) {
      throw new BadRequestException('El tiempo para confirmar venció');
    }

    booking.status = BookingStatus.CONFIRMED;
    booking.confirmationDeadline = null as unknown as Date;
    const saved = await this.bookingsRepository.save(booking);
    await this.schedulesRepository.increment(
      { id: booking.schedule.id },
      'enrolledCount',
      1,
    );
    await this.schedulesRepository.update(
      { id: booking.schedule.id },
      { emptyAt: null },
    );
    return saved;
  }

  async getWaitlistPosition(
    bookingId: string,
    scheduleId: string,
  ): Promise<number> {
    const earlier = await this.bookingsRepository
      .createQueryBuilder('b')
      .where('b.schedule.id = :scheduleId', { scheduleId })
      .andWhere('b.status = :status', { status: BookingStatus.WAITLIST })
      .andWhere('b.id != :bookingId', { bookingId })
      .andWhere(
        '(SELECT b2."createdAt" FROM bookings b2 WHERE b2.id = :bookingId) > b."createdAt"',
        { bookingId },
      )
      .getCount();
    return earlier + 1;
  }

  async getWaitlistTotal(scheduleId: string): Promise<number> {
    return this.bookingsRepository.count({
      where: { schedule: { id: scheduleId }, status: BookingStatus.WAITLIST },
    });
  }

  async getMonthlyClassCountForUser(
    userId: string,
    month?: string,
  ): Promise<number> {
    return this.countMonthBookings(userId, month ?? this.currentMonth());
  }

  async countNoShowsForUser(userId: string, month?: string): Promise<number> {
    const m = month ?? this.currentMonth();
    const { start, end } = this.monthRange(m);
    return this.bookingsRepository
      .createQueryBuilder('b')
      .innerJoin('b.schedule', 's')
      .where('b.user.id = :userId', { userId })
      .andWhere('b.attendanceStatus = :status', {
        status: AttendanceStatus.ABSENT,
      })
      .andWhere('s.date >= :start AND s.date < :end', { start, end })
      .getCount();
  }

  private async promoteFromWaitlist(schedule: Schedule): Promise<void> {
    const scheduleStart = this.getScheduleStart(schedule);
    const hoursUntilClass = (scheduleStart.getTime() - Date.now()) / 36e5;

    // No promover si queda menos de WAITLIST_MIN_HOURS antes de la clase
    if (hoursUntilClass < WAITLIST_MIN_HOURS) return;

    const next = await this.bookingsRepository.findOne({
      where: { schedule: { id: schedule.id }, status: BookingStatus.WAITLIST },
      order: { createdAt: 'ASC' },
    });
    if (!next) return;

    // Calcular deadline de confirmación: 1 hora desde ahora, pero no más allá de (clase - 3hs)
    const confirmationLimit = new Date(
      scheduleStart.getTime() - WAITLIST_MIN_HOURS * 36e5,
    );
    const oneHourFromNow = new Date(Date.now() + CONFIRMATION_HOURS * 36e5);
    const deadline =
      oneHourFromNow < confirmationLimit ? oneHourFromNow : confirmationLimit;

    next.status = BookingStatus.PENDING_CONFIRMATION;
    next.confirmationDeadline = deadline;
    await this.bookingsRepository.save(next);

    const appUrl =
      this.config.get<string>('APP_URL') ?? 'http://localhost:3001';
    const confirmUrl = `${appUrl}/student/bookings`;

    void this.notifications.waitlistPromotion(
      next.user.id,
      next.user.email,
      next.user.firstName,
      schedule.pilatesClass?.name ?? 'clase',
      schedule.date,
      schedule.startTime.substring(0, 5),
      confirmUrl,
      deadline,
    );
  }

  // Cron: cada 2 minutos, expire confirmaciones vencidas y promueve la siguiente
  @Cron(CronExpression.EVERY_5_MINUTES)
  async expireStaleConfirmations(): Promise<void> {
    const expired = await this.bookingsRepository
      .createQueryBuilder('b')
      .innerJoinAndSelect('b.schedule', 's')
      .innerJoinAndSelect('b.user', 'u')
      .where('b.status = :status', {
        status: BookingStatus.PENDING_CONFIRMATION,
      })
      .andWhere('b.confirmationDeadline < :now', { now: new Date() })
      .getMany();

    for (const booking of expired) {
      booking.status = BookingStatus.WAITLIST;
      booking.confirmationDeadline = null as unknown as Date;
      await this.bookingsRepository.save(booking);

      void this.notifications.waitlistExpired(
        booking.user.id,
        booking.user.email,
        booking.user.firstName,
        booking.schedule.pilatesClass?.name ?? 'clase',
      );

      // Promover siguiente en lista
      await this.promoteFromWaitlist(booking.schedule);
    }
  }

  async markAttendance(
    bookingId: string,
    status: AttendanceStatus,
    user: User,
  ): Promise<Booking> {
    const booking = await this.bookingsRepository.findOne({
      where: { id: bookingId },
      relations: ['schedule', 'schedule.instructor'],
    });
    if (!booking) throw new NotFoundException('Reserva no encontrada');

    // Permisos: admin o instructora de esa clase
    if (user.role !== UserRole.ADMIN) {
      if (
        user.role !== UserRole.INSTRUCTOR ||
        booking.schedule.instructor.email !== user.email
      ) {
        throw new ForbiddenException('No tenés permiso para marcar asistencia');
      }
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        'Solo se puede marcar asistencia en reservas confirmadas',
      );
    }

    const start = this.getScheduleStart(booking.schedule);
    if (start.getTime() > Date.now()) {
      throw new BadRequestException(
        'No se puede marcar asistencia antes de que empiece la clase',
      );
    }

    booking.attendanceStatus = status;
    booking.attendanceMarkedAt = new Date();
    booking.attendanceMarkedBy = user;
    const saved = await this.bookingsRepository.save(booking);

    if (status === AttendanceStatus.ABSENT) {
      const month = booking.schedule.date.substring(0, 7);
      const count = await this.countNoShowsForUser(booking.user.id, month);
      if (count >= NO_SHOW_WARNING_THRESHOLD) {
        void this.notifications.noShowWarning(
          booking.user.id,
          booking.user.email,
          booking.user.firstName,
          count,
          month,
        );
      }
    }

    return saved;
  }
}
