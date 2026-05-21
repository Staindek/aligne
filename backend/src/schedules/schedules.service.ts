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
import { Cron, CronExpression } from '@nestjs/schedule';
import { Between, LessThan, Not, Repository } from 'typeorm';
import { Schedule } from './entities/schedule.entity';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { ClassesService } from '../classes/classes.service';
import { InstructorsService } from '../instructors/instructors.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { User, UserRole } from '../users/entities/user.entity';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { BulkCreateSchedulesDto } from './dto/bulk-create-schedules.dto';
import { RecurringBookingsService } from '../bookings/recurring-bookings.service';

export interface BulkResult {
  created: Schedule[];
  skipped: { date: string; reason: string }[];
}

// Tiempo que una clase puede estar vacía antes de auto-cancelarse
const EMPTY_CLASS_AUTO_CANCEL_HOURS = 1;
// Solo avisar a la instructora si la clase es dentro de N horas
const AUTO_CANCEL_NOTIFY_HOURS = 24;

@Injectable()
export class SchedulesService {
  constructor(
    @InjectRepository(Schedule)
    private readonly schedulesRepository: Repository<Schedule>,
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly classesService: ClassesService,
    private readonly instructorsService: InstructorsService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
    private readonly notifications: NotificationsService,
    @Inject(forwardRef(() => RecurringBookingsService))
    private readonly recurringBookings: RecurringBookingsService,
  ) {}

  private assertEndAfterStart(startTime: string, endTime: string): void {
    if (endTime <= startTime)
      throw new BadRequestException(
        'El horario de fin debe ser posterior al de inicio',
      );
  }

  private async assertNoInstructorOverlap(
    instructorId: string,
    date: string,
    startTime: string,
    endTime: string,
    excludeScheduleId?: string,
  ): Promise<void> {
    const sessions = await this.schedulesRepository.find({
      where: {
        instructor: { id: instructorId },
        date,
        isCancelled: false,
        ...(excludeScheduleId ? { id: Not(excludeScheduleId) } : {}),
      },
    });

    const overlaps = sessions.some((s) => {
      const sStart = s.startTime.substring(0, 5);
      const sEnd = s.endTime.substring(0, 5);
      return startTime < sEnd && endTime > sStart;
    });

    if (overlaps)
      throw new ConflictException(
        'La instructora ya tiene una sesión en ese horario',
      );
  }

  private assertCanModify(schedule: Schedule, user: User): void {
    if (user.role === UserRole.ADMIN) return;
    if (user.role === UserRole.INSTRUCTOR && schedule.instructor.email === user.email) return;
    throw new ForbiddenException('No tenés permiso para modificar esta clase');
  }

  async create(dto: CreateScheduleDto): Promise<Schedule> {
    this.assertEndAfterStart(dto.startTime, dto.endTime);

    const [pilatesClass, instructor] = await Promise.all([
      this.classesService.findOne(dto.pilatesClassId),
      this.instructorsService.findOne(dto.instructorId),
    ]);

    await this.assertNoInstructorOverlap(
      instructor.id,
      dto.date,
      dto.startTime,
      dto.endTime,
    );

    const schedule = this.schedulesRepository.create({
      pilatesClass,
      instructor,
      date: dto.date,
      startTime: dto.startTime,
      endTime: dto.endTime,
      maxCapacity: dto.maxCapacity ?? pilatesClass.maxCapacity,
    });

    const saved = await this.schedulesRepository.save(schedule);
    void this.notifyClassCreated(saved);
    await this.recurringBookings.attachToSchedule(saved.id);
    return saved;
  }

  async bulkCreate(dto: BulkCreateSchedulesDto): Promise<BulkResult> {
    const start = new Date(`${dto.startDate}T00:00:00`);
    const end = new Date(`${dto.endDate}T00:00:00`);
    if (end < start) {
      throw new BadRequestException('La fecha de fin debe ser posterior a la de inicio');
    }

    const [pilatesClass, instructor] = await Promise.all([
      this.classesService.findOne(dto.pilatesClassId),
      this.instructorsService.findOne(dto.instructorId),
    ]);

    const endTime = this.addMinutes(dto.startTime, pilatesClass.durationMinutes);
    this.assertEndAfterStart(dto.startTime, endTime);

    const daysSet = new Set(dto.daysOfWeek);
    const created: Schedule[] = [];
    const skipped: { date: string; reason: string }[] = [];

    for (
      let cursor = new Date(start);
      cursor.getTime() <= end.getTime();
      cursor.setDate(cursor.getDate() + 1)
    ) {
      if (!daysSet.has(cursor.getDay())) continue;
      const isoDate = cursor.toISOString().substring(0, 10);

      try {
        await this.assertNoInstructorOverlap(instructor.id, isoDate, dto.startTime, endTime);
      } catch (e) {
        skipped.push({
          date: isoDate,
          reason: e instanceof Error ? e.message : 'Conflicto de horario',
        });
        continue;
      }

      const schedule = this.schedulesRepository.create({
        pilatesClass,
        instructor,
        date: isoDate,
        startTime: dto.startTime,
        endTime,
        maxCapacity: pilatesClass.maxCapacity,
      });
      const saved = await this.schedulesRepository.save(schedule);
      void this.notifyClassCreated(saved);
      await this.recurringBookings.attachToSchedule(saved.id);
      created.push(saved);
    }

    return { created, skipped };
  }

  /**
   * Replica la grilla del mes anterior al mes objetivo (YYYY-MM).
   * Agrupa schedules previos por (díaSemana + horaInicio + modalidad + instructora)
   * y crea un schedule por cada día matching del mes objetivo.
   * Idempotente: skip si ya existe un schedule no cancelado en (instructora, fecha, hora).
   */
  async generateFromPreviousMonth(targetMonth: string): Promise<BulkResult> {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(targetMonth)) {
      throw new BadRequestException('Mes inválido (formato YYYY-MM)');
    }
    const [y, m] = targetMonth.split('-').map(Number);
    const prevY = m === 1 ? y - 1 : y;
    const prevM = m === 1 ? 12 : m - 1;
    const prevMonth = `${prevY}-${String(prevM).padStart(2, '0')}`;
    const prevLastDay = new Date(y, m - 1, 0).getDate();
    const prevStart = `${prevMonth}-01`;
    const prevEnd = `${prevMonth}-${String(prevLastDay).padStart(2, '0')}`;

    const prevSchedules = await this.schedulesRepository.find({
      where: { date: Between(prevStart, prevEnd), isCancelled: false },
    });

    const patterns = new Map<
      string,
      {
        dow: number;
        startTime: string;
        endTime: string;
        classId: string;
        instructorId: string;
        maxCapacity: number;
      }
    >();
    for (const s of prevSchedules) {
      const dow = new Date(`${s.date}T00:00:00`).getDay();
      const key = `${dow}|${s.startTime}|${s.pilatesClass.id}|${s.instructor.id}`;
      if (!patterns.has(key)) {
        patterns.set(key, {
          dow,
          startTime: s.startTime,
          endTime: s.endTime,
          classId: s.pilatesClass.id,
          instructorId: s.instructor.id,
          maxCapacity: s.maxCapacity,
        });
      }
    }

    const created: Schedule[] = [];
    const skipped: { date: string; reason: string }[] = [];
    if (patterns.size === 0) return { created, skipped };

    const classCache = new Map<string, Awaited<ReturnType<typeof this.classesService.findOne>>>();
    const instructorCache = new Map<string, Awaited<ReturnType<typeof this.instructorsService.findOne>>>();

    const targetLastDay = new Date(y, m, 0).getDate();
    for (let d = 1; d <= targetLastDay; d++) {
      const isoDate = `${targetMonth}-${String(d).padStart(2, '0')}`;
      const dow = new Date(`${isoDate}T00:00:00`).getDay();

      for (const p of patterns.values()) {
        if (p.dow !== dow) continue;

        const existing = await this.schedulesRepository.findOne({
          where: {
            instructor: { id: p.instructorId },
            date: isoDate,
            startTime: p.startTime,
            isCancelled: false,
          },
        });
        if (existing) {
          skipped.push({ date: isoDate, reason: 'Ya existe' });
          continue;
        }

        try {
          await this.assertNoInstructorOverlap(p.instructorId, isoDate, p.startTime, p.endTime);
        } catch (e) {
          skipped.push({
            date: isoDate,
            reason: e instanceof Error ? e.message : 'Conflicto de horario',
          });
          continue;
        }

        if (!classCache.has(p.classId)) {
          classCache.set(p.classId, await this.classesService.findOne(p.classId));
        }
        if (!instructorCache.has(p.instructorId)) {
          instructorCache.set(p.instructorId, await this.instructorsService.findOne(p.instructorId));
        }

        const schedule = this.schedulesRepository.create({
          pilatesClass: classCache.get(p.classId)!,
          instructor: instructorCache.get(p.instructorId)!,
          date: isoDate,
          startTime: p.startTime,
          endTime: p.endTime,
          maxCapacity: p.maxCapacity,
        });
        const saved = await this.schedulesRepository.save(schedule);
        void this.notifyClassCreated(saved);
        await this.recurringBookings.attachToSchedule(saved.id);
        created.push(saved);
      }
    }

    return { created, skipped };
  }

  /**
   * Cron: el día 1 de cada mes a las 00:05 genera el mes actual a partir del anterior.
   */
  @Cron('5 0 1 * *')
  async cronGenerateMonthFromPrevious(): Promise<void> {
    const now = new Date();
    const targetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    try {
      const result = await this.generateFromPreviousMonth(targetMonth);
      console.log(
        `[cron] generate-month ${targetMonth}: creadas ${result.created.length}, salteadas ${result.skipped.length}`,
      );
    } catch (e) {
      console.error('[cron] generate-month failed', e);
    }
  }

  private addMinutes(hhmm: string, minutes: number): string {
    const [h, m] = hhmm.split(':').map(Number);
    const total = h * 60 + m + minutes;
    const nh = Math.floor(total / 60) % 24;
    const nm = total % 60;
    return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
  }

  findAll(): Promise<Schedule[]> {
    return this.schedulesRepository.find({
      where: { isCancelled: false },
      order: { date: 'ASC', startTime: 'ASC' },
    });
  }

  findByDate(date: string): Promise<Schedule[]> {
    return this.schedulesRepository.find({
      where: { date, isCancelled: false },
      order: { startTime: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Schedule> {
    const schedule = await this.schedulesRepository.findOne({ where: { id } });
    if (!schedule) throw new NotFoundException(`Sesión ${id} no encontrada`);
    return schedule;
  }

  async update(id: string, dto: UpdateScheduleDto, user: User): Promise<Schedule> {
    const schedule = await this.findOne(id);
    this.assertCanModify(schedule, user);

    if (dto.pilatesClassId) {
      schedule.pilatesClass = await this.classesService.findOne(dto.pilatesClassId);
    }
    if (dto.instructorId) {
      if (user.role !== UserRole.ADMIN)
        throw new ForbiddenException('Solo admin puede cambiar la instructora');
      schedule.instructor = await this.instructorsService.findOne(dto.instructorId);
    }

    const { pilatesClassId, instructorId, ...rest } = dto;
    void pilatesClassId;
    void instructorId;
    Object.assign(schedule, rest);

    const finalStart = schedule.startTime.substring(0, 5);
    const finalEnd = schedule.endTime.substring(0, 5);
    this.assertEndAfterStart(finalStart, finalEnd);

    await this.assertNoInstructorOverlap(
      schedule.instructor.id,
      schedule.date,
      finalStart,
      finalEnd,
      id,
    );

    return this.schedulesRepository.save(schedule);
  }

  async cancel(id: string, user: User): Promise<Schedule> {
    const schedule = await this.findOne(id);
    this.assertCanModify(schedule, user);
    if (schedule.isCancelled)
      throw new BadRequestException('La sesión ya está cancelada');

    schedule.isCancelled = true;
    const saved = await this.schedulesRepository.save(schedule);
    await this.cancelBookingsAndNotify(saved);
    return saved;
  }

  private async notifyClassCreated(schedule: Schedule): Promise<void> {
    const month = schedule.date.substring(0, 7);
    const students = await this.paymentsService.findPaidStudentsForMonth(month);
    const className = schedule.pilatesClass.name;
    const time = schedule.startTime.substring(0, 5);
    const instructorName = `${schedule.instructor.firstName} ${schedule.instructor.lastName}`;
    for (const u of students) {
      void this.notifications.classCreated(
        u.id,
        u.email,
        u.firstName,
        className,
        schedule.date,
        time,
        instructorName,
      );
    }
  }

  private async cancelBookingsAndNotify(schedule: Schedule): Promise<void> {
    const activeBookings = await this.bookingsRepository.find({
      where: [
        { schedule: { id: schedule.id }, status: BookingStatus.CONFIRMED },
        { schedule: { id: schedule.id }, status: BookingStatus.PENDING_CONFIRMATION },
        { schedule: { id: schedule.id }, status: BookingStatus.WAITLIST },
      ],
    });

    const className = schedule.pilatesClass.name;
    const time = schedule.startTime.substring(0, 5);

    for (const b of activeBookings) {
      b.status = BookingStatus.CANCELLED;
      b.cancelledAt = new Date();
      await this.bookingsRepository.save(b);
      void this.notifications.classCancelled(
        b.user.id,
        b.user.email,
        b.user.firstName,
        className,
        schedule.date,
        time,
      );
    }

    schedule.enrolledCount = 0;
    await this.schedulesRepository.save(schedule);
  }

  /**
   * Cron: cada 5 minutos busca clases vacías desde hace >EMPTY_CLASS_AUTO_CANCEL_HOURS
   * y las cancela. Notifica a la instructora si la clase está dentro de AUTO_CANCEL_NOTIFY_HOURS.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async autoCancelEmptyClasses(): Promise<void> {
    const threshold = new Date(
      Date.now() - EMPTY_CLASS_AUTO_CANCEL_HOURS * 36e5,
    );
    const candidates = await this.schedulesRepository.find({
      where: {
        isCancelled: false,
        enrolledCount: 0,
        emptyAt: LessThan(threshold),
      },
    });

    for (const schedule of candidates) {
      const start = new Date(
        `${schedule.date}T${schedule.startTime.substring(0, 5)}:00`,
      );
      // Si la clase ya empezó, no tiene sentido auto-cancelar — dejarla pasar
      if (start.getTime() <= Date.now()) {
        // Limpiar emptyAt para no quedar en la query indefinidamente
        await this.schedulesRepository.update(
          { id: schedule.id },
          { emptyAt: null },
        );
        continue;
      }

      schedule.isCancelled = true;
      await this.schedulesRepository.save(schedule);

      // Notificar instructora solo si la clase es pronto
      const hoursUntil = (start.getTime() - Date.now()) / 36e5;
      if (hoursUntil <= AUTO_CANCEL_NOTIFY_HOURS) {
        const instructorUser = await this.usersRepository.findOne({
          where: { email: schedule.instructor.email },
        });
        await this.notifications.classAutoCancelled({
          instructorEmail: schedule.instructor.email,
          instructorFirstName: schedule.instructor.firstName,
          instructorUserId: instructorUser?.id,
          className: schedule.pilatesClass.name,
          date: schedule.date,
          startTime: schedule.startTime.substring(0, 5),
        });
      }
    }
  }
}
