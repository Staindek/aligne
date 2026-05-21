import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { RecurringBooking } from './entities/recurring-booking.entity';
import { Booking, BookingStatus } from './entities/booking.entity';
import { Schedule } from '../schedules/entities/schedule.entity';
import { User } from '../users/entities/user.entity';
import { canTakeLevel } from '../common/enums/level.enum';
import { PaymentsService } from '../payments/payments.service';
import { MaterializationProposalsService } from './materialization-proposals.service';
import { ProposalCandidate } from './entities/materialization-proposal.entity';
import { hasTimeConflict } from './booking-overlap.helper';

@Injectable()
export class RecurringBookingsService {
  constructor(
    @InjectRepository(RecurringBooking)
    private readonly recurringRepo: Repository<RecurringBooking>,
    @InjectRepository(Booking)
    private readonly bookingsRepo: Repository<Booking>,
    @InjectRepository(Schedule)
    private readonly schedulesRepo: Repository<Schedule>,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
    @Inject(forwardRef(() => MaterializationProposalsService))
    private readonly proposalsService: MaterializationProposalsService,
  ) {}

  private todayISO(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private getScheduleStart(schedule: Schedule): Date {
    const time = schedule.startTime.substring(0, 5);
    return new Date(`${schedule.date}T${time}:00`);
  }

  private dayOfWeekFromISO(date: string): number {
    return new Date(`${date}T00:00:00`).getDay();
  }

  private monthRange(month: string): { start: string; end: string } {
    const [y, m] = month.split('-').map(Number);
    const start = `${month}-01`;
    const nextY = m === 12 ? y + 1 : y;
    const nextM = m === 12 ? 1 : m + 1;
    const end = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
    return { start, end };
  }

  private async countMonthBookings(userId: string, month: string): Promise<number> {
    const { start, end } = this.monthRange(month);
    return this.bookingsRepo
      .createQueryBuilder('b')
      .innerJoin('b.schedule', 's')
      .where('b.user.id = :userId', { userId })
      .andWhere('b.status IN (:...statuses)', {
        statuses: [BookingStatus.CONFIRMED, BookingStatus.PENDING_CONFIRMATION],
      })
      .andWhere('s.date >= :start AND s.date < :end', { start, end })
      .getCount();
  }

  /**
   * Intenta crear un booking ligado a una recurrente.
   * Silencioso: devuelve null si no se puede (cupo, pack, nivel, ya pasó, duplicado).
   */
  private async tryCreateBookingForRecurring(
    schedule: Schedule,
    recurring: RecurringBooking,
  ): Promise<Booking | null> {
    if (schedule.isCancelled) return null;
    if (this.getScheduleStart(schedule).getTime() <= Date.now()) return null;

    if (!canTakeLevel(recurring.user.level, schedule.pilatesClass.level)) return null;

    const sessionMonth = schedule.date.substring(0, 7);
    const limit = await this.paymentsService.getMonthClassLimit(
      recurring.user.id,
      sessionMonth,
    );
    // Recurrentes solo materializan en meses pagados (con pack activo).
    if (limit === 0) return null;
    if (limit !== null && limit > 0) {
      const monthCount = await this.countMonthBookings(recurring.user.id, sessionMonth);
      if (monthCount >= limit) return null;
    }

    const existing = await this.bookingsRepo.findOne({
      where: {
        user: { id: recurring.user.id },
        schedule: { id: schedule.id },
        status: In([
          BookingStatus.CONFIRMED,
          BookingStatus.PENDING_CONFIRMATION,
          BookingStatus.WAITLIST,
        ]),
      },
    });
    if (existing) return null;

    // Saltear si choca con otra clase en el mismo horario (consecutivas ok).
    const conflict = await hasTimeConflict(
      this.bookingsRepo,
      recurring.user.id,
      schedule.date,
      schedule.startTime,
      schedule.endTime,
    );
    if (conflict) return null;

    // Recurrente no va a lista de espera: si está llena, no se materializa.
    if (schedule.enrolledCount >= schedule.maxCapacity) return null;

    const booking = this.bookingsRepo.create({
      user: recurring.user,
      schedule,
      status: BookingStatus.CONFIRMED,
      recurringBooking: recurring,
    });
    const saved = await this.bookingsRepo.save(booking);
    await this.schedulesRepo.increment({ id: schedule.id }, 'enrolledCount', 1);
    await this.schedulesRepo.update({ id: schedule.id }, { emptyAt: null });
    return saved;
  }

  async createFromSchedule(
    scheduleId: string,
    user: User,
  ): Promise<{
    recurring: RecurringBooking;
    materializedCount: number;
    skippedCount: number;
  }> {
    const schedule = await this.schedulesRepo.findOne({ where: { id: scheduleId } });
    if (!schedule) throw new NotFoundException('Sesión no encontrada');

    if (!canTakeLevel(user.level, schedule.pilatesClass.level)) {
      throw new ForbiddenException(
        `Esta clase es de nivel ${schedule.pilatesClass.level}. Hablá con el estudio si querés cambiar tu nivel.`,
      );
    }

    const dayOfWeek = this.dayOfWeekFromISO(schedule.date);

    const existingRec = await this.recurringRepo.findOne({
      where: {
        user: { id: user.id },
        pilatesClass: { id: schedule.pilatesClass.id },
        dayOfWeek,
        startTime: schedule.startTime,
        isActive: true,
      },
    });
    if (existingRec) {
      throw new ConflictException('Ya tenés una reserva fija para este día y hora');
    }

    const recurring = this.recurringRepo.create({
      user,
      pilatesClass: schedule.pilatesClass,
      dayOfWeek,
      startTime: schedule.startTime,
      isActive: true,
    });
    const savedRec = await this.recurringRepo.save(recurring);

    // Materializar bookings solo del mes del schedule referenciado.
    // Meses futuros se materializarán cuando la alumna pague ese mes.
    const month = schedule.date.substring(0, 7);
    const { start, end } = this.monthBounds(month);
    const today = this.todayISO();
    const lowerBound = today > start ? today : start;
    const candidates = await this.schedulesRepo.find({
      where: {
        date: Between(lowerBound, end),
        startTime: schedule.startTime,
        pilatesClass: { id: schedule.pilatesClass.id },
        isCancelled: false,
      },
    });

    let materialized = 0;
    let skipped = 0;
    for (const candidate of candidates) {
      if (this.dayOfWeekFromISO(candidate.date) !== dayOfWeek) continue;
      const result = await this.tryCreateBookingForRecurring(candidate, savedRec);
      if (result) materialized++;
      else skipped++;
    }

    return { recurring: savedRec, materializedCount: materialized, skippedCount: skipped };
  }

  /**
   * Llamado por PaymentsService al confirmar un pago:
   * - Si los candidatos de las recurrentes activas entran en el cap del mes, materializa todo.
   * - Si exceden el cap, crea una propuesta pendiente para que la alumnx elija cuáles materializar
   *   (no se crea ningún booking hasta que confirme o se auto-resuelva al vencerse el plazo).
   */
  async materializeForUserMonth(userId: string, month: string): Promise<number> {
    const recurrents = await this.recurringRepo.find({
      where: { user: { id: userId }, isActive: true },
    });
    if (recurrents.length === 0) return 0;

    const limit = await this.paymentsService.getMonthClassLimit(userId, month);
    if (limit === 0) return 0;

    const { end } = this.monthBounds(month);
    const today = this.todayISO();
    const lowerBound = today > `${month}-01` ? today : `${month}-01`;

    // Existentes ya reservadas en el mes (no duplicar)
    const existingCount = await this.countMonthBookings(userId, month);
    const remainingCap = limit === null ? Infinity : Math.max(0, limit - existingCount);

    // Recolectar candidatos elegibles
    const candidates: Array<{ schedule: Schedule; recurring: RecurringBooking; priority: number }> = [];
    for (const rec of recurrents) {
      const schedules = await this.schedulesRepo.find({
        where: {
          date: Between(lowerBound, end),
          startTime: rec.startTime,
          pilatesClass: { id: rec.pilatesClass.id },
          isCancelled: false,
        },
      });
      for (const s of schedules) {
        if (this.dayOfWeekFromISO(s.date) !== rec.dayOfWeek) continue;
        if (this.getScheduleStart(s).getTime() <= Date.now()) continue;
        if (!canTakeLevel(rec.user.level, s.pilatesClass.level)) continue;
        if (s.enrolledCount >= s.maxCapacity) continue;
        // Saltear si ya hay booking activo (incluye recurrentes ya materializadas)
        const dup = await this.bookingsRepo.findOne({
          where: {
            user: { id: userId },
            schedule: { id: s.id },
            status: In([
              BookingStatus.CONFIRMED,
              BookingStatus.PENDING_CONFIRMATION,
              BookingStatus.WAITLIST,
            ]),
          },
        });
        if (dup) continue;

        candidates.push({ schedule: s, recurring: rec, priority: rec.createdAt.getTime() });
      }
    }

    if (candidates.length === 0) return 0;

    // Cap ilimitado o entra todo → materializar directo
    if (remainingCap === Infinity || candidates.length <= remainingCap) {
      let created = 0;
      for (const c of candidates) {
        const result = await this.tryCreateBookingForRecurring(c.schedule, c.recurring);
        if (result) created++;
      }
      return created;
    }

    // Excede: crear propuesta para que la alumnx elija
    const proposalCandidates: ProposalCandidate[] = candidates
      .sort((a, b) => a.priority - b.priority)
      .map((c) => ({
        scheduleId: c.schedule.id,
        recurringId: c.recurring.id,
        priority: c.priority,
      }));
    await this.proposalsService.createOrReplaceProposal(
      userId,
      month,
      proposalCandidates,
      remainingCap,
    );
    return 0;
  }

  private monthBounds(month: string): { start: string; end: string } {
    const [y, m] = month.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return {
      start: `${month}-01`,
      end: `${month}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  async findMyActive(userId: string): Promise<RecurringBooking[]> {
    return this.recurringRepo.find({
      where: { user: { id: userId }, isActive: true },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
  }

  async cancel(
    id: string,
    user: User,
  ): Promise<{ recurring: RecurringBooking; cancelledCount: number }> {
    const recurring = await this.recurringRepo.findOne({
      where: { id, user: { id: user.id }, isActive: true },
    });
    if (!recurring) throw new NotFoundException('Reserva fija no encontrada');

    recurring.isActive = false;
    recurring.cancelledAt = new Date();
    await this.recurringRepo.save(recurring);

    const futureBookings = await this.bookingsRepo.find({
      where: {
        recurringBooking: { id },
        status: In([
          BookingStatus.CONFIRMED,
          BookingStatus.PENDING_CONFIRMATION,
          BookingStatus.WAITLIST,
        ]),
      },
      relations: ['schedule'],
    });

    let cancelledCount = 0;
    for (const booking of futureBookings) {
      if (this.getScheduleStart(booking.schedule).getTime() <= Date.now()) continue;

      const wasConfirmed = booking.status !== BookingStatus.WAITLIST;
      booking.status = BookingStatus.CANCELLED;
      booking.cancelledAt = new Date();
      await this.bookingsRepo.save(booking);

      if (wasConfirmed) {
        await this.schedulesRepo.decrement(
          { id: booking.schedule.id },
          'enrolledCount',
          1,
        );
        const fresh = await this.schedulesRepo.findOne({
          where: { id: booking.schedule.id },
        });
        if (fresh && fresh.enrolledCount === 0 && !fresh.emptyAt) {
          await this.schedulesRepo.update(
            { id: booking.schedule.id },
            { emptyAt: new Date() },
          );
        }
      }
      cancelledCount++;
    }

    return { recurring, cancelledCount };
  }

  /**
   * Llamado por SchedulesService al crear un schedule:
   * busca recurrentes activas que matcheen y materializa bookings.
   */
  async attachToSchedule(scheduleId: string): Promise<number> {
    const schedule = await this.schedulesRepo.findOne({ where: { id: scheduleId } });
    if (!schedule || schedule.isCancelled) return 0;

    const dayOfWeek = this.dayOfWeekFromISO(schedule.date);
    const recurrents = await this.recurringRepo.find({
      where: {
        isActive: true,
        pilatesClass: { id: schedule.pilatesClass.id },
        dayOfWeek,
        startTime: schedule.startTime,
      },
    });

    let created = 0;
    for (const rec of recurrents) {
      const fresh = await this.schedulesRepo.findOne({ where: { id: schedule.id } });
      if (!fresh) continue;
      const result = await this.tryCreateBookingForRecurring(fresh, rec);
      if (result) created++;
    }
    return created;
  }
}
