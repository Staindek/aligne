import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import {
  MaterializationProposal,
  ProposalCandidate,
  ProposalStatus,
} from './entities/materialization-proposal.entity';
import { Booking, BookingStatus } from './entities/booking.entity';
import { RecurringBooking } from './entities/recurring-booking.entity';
import { Schedule } from '../schedules/entities/schedule.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { canTakeLevel } from '../common/enums/level.enum';
import { hasTimeConflict } from './booking-overlap.helper';

const PROPOSAL_DEADLINE_HOURS = 24;

@Injectable()
export class MaterializationProposalsService {
  private readonly logger = new Logger(MaterializationProposalsService.name);

  constructor(
    @InjectRepository(MaterializationProposal)
    private readonly proposalsRepo: Repository<MaterializationProposal>,
    @InjectRepository(Booking)
    private readonly bookingsRepo: Repository<Booking>,
    @InjectRepository(Schedule)
    private readonly schedulesRepo: Repository<Schedule>,
    @InjectRepository(RecurringBooking)
    private readonly recurringRepo: Repository<RecurringBooking>,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Llamado por RecurringBookingsService.materializeForUserMonth cuando los candidatos exceden el cap.
   * Crea (o reemplaza) una propuesta pendiente para que la alumna elija cuáles materializar.
   */
  async createOrReplaceProposal(
    userId: string,
    month: string,
    candidates: ProposalCandidate[],
    cap: number,
  ): Promise<MaterializationProposal> {
    // Cancelar propuesta pendiente previa para el mismo mes (si existe)
    await this.proposalsRepo.update(
      { user: { id: userId }, month, status: ProposalStatus.PENDING },
      { status: ProposalStatus.CANCELLED, resolvedAt: new Date() },
    );

    const deadline = new Date(
      Date.now() + PROPOSAL_DEADLINE_HOURS * 3600 * 1000,
    );
    const proposal = this.proposalsRepo.create({
      user: { id: userId },
      month,
      status: ProposalStatus.PENDING,
      cap,
      candidates,
      deadlineAt: deadline,
    });
    const saved = await this.proposalsRepo.save(proposal);

    // Cargar user para la notificación (email/nombre)
    const full = await this.proposalsRepo.findOne({ where: { id: saved.id } });
    if (full) {
      void this.notifications.materializationPending(
        full.user.id,
        full.user.email,
        full.user.firstName,
        month,
        candidates.length,
        cap,
        full.id,
      );
    }

    return saved;
  }

  async findPendingForUser(userId: string): Promise<MaterializationProposal[]> {
    return this.proposalsRepo.find({
      where: { user: { id: userId }, status: ProposalStatus.PENDING },
      order: { createdAt: 'DESC' },
    });
  }

  async findByIdForUser(
    id: string,
    userId: string,
  ): Promise<MaterializationProposal> {
    const proposal = await this.proposalsRepo.findOne({ where: { id } });
    if (!proposal) throw new NotFoundException('Propuesta no encontrada');
    if (proposal.user.id !== userId)
      throw new ForbiddenException('No autorizado');
    return proposal;
  }

  // Devuelve la propuesta + los schedules de cada candidato (para el UI de elección)
  async findByIdForUserDetailed(
    id: string,
    userId: string,
  ): Promise<{ proposal: MaterializationProposal; schedules: Schedule[] }> {
    const proposal = await this.findByIdForUser(id, userId);
    const scheduleIds = proposal.candidates.map((c) => c.scheduleId);
    const schedules = scheduleIds.length
      ? await this.schedulesRepo.find({ where: { id: In(scheduleIds) } })
      : [];
    return { proposal, schedules };
  }

  /**
   * La alumna confirma qué scheduleIds materializar (subconjunto de candidates).
   * Crea las reservas correspondientes y marca la propuesta como resuelta.
   */
  async resolveByUser(
    id: string,
    userId: string,
    selectedScheduleIds: string[],
  ): Promise<{ proposal: MaterializationProposal; materialized: number }> {
    const proposal = await this.findByIdForUser(id, userId);
    if (proposal.status !== ProposalStatus.PENDING) {
      throw new BadRequestException('Esta elección ya fue resuelta');
    }
    if (selectedScheduleIds.length > proposal.cap) {
      throw new BadRequestException(
        `Tu pack permite hasta ${proposal.cap} clases este mes.`,
      );
    }
    const candidateIds = new Set(proposal.candidates.map((c) => c.scheduleId));
    for (const sid of selectedScheduleIds) {
      if (!candidateIds.has(sid)) {
        throw new BadRequestException(
          'Hay clases que ya no son válidas para este mes',
        );
      }
    }

    const selected = proposal.candidates.filter((c) =>
      selectedScheduleIds.includes(c.scheduleId),
    );

    // Validar que las clases elegidas no se pisen entre sí ni con reservas previas
    const selectedSchedules = selectedScheduleIds.length
      ? await this.schedulesRepo.find({
          where: { id: In(selectedScheduleIds) },
        })
      : [];
    for (let i = 0; i < selectedSchedules.length; i++) {
      for (let j = i + 1; j < selectedSchedules.length; j++) {
        const a = selectedSchedules[i];
        const b = selectedSchedules[j];
        if (
          a.date === b.date &&
          a.startTime < b.endTime &&
          a.endTime > b.startTime
        ) {
          throw new BadRequestException(
            'Elegiste dos clases que se pisan en el mismo horario',
          );
        }
      }
    }
    for (const s of selectedSchedules) {
      const conflict = await hasTimeConflict(
        this.bookingsRepo,
        userId,
        s.date,
        s.startTime,
        s.endTime,
      );
      if (conflict) {
        throw new BadRequestException(
          `Tenés otra reserva que se pisa con la clase del ${s.date} a las ${s.startTime.substring(0, 5)}`,
        );
      }
    }

    const materialized = await this.materializeCandidates(selected, userId);

    proposal.status = ProposalStatus.RESOLVED;
    proposal.resolvedAt = new Date();
    await this.proposalsRepo.save(proposal);

    return { proposal, materialized };
  }

  /**
   * Cron: cada 30 min, busca propuestas pendientes con deadline vencido y las auto-resuelve
   * tomando las primeras `cap` candidatas por prioridad (recurrente más antigua primero).
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async autoResolveExpired(): Promise<void> {
    const expired = await this.proposalsRepo.find({
      where: {
        status: ProposalStatus.PENDING,
        deadlineAt: LessThan(new Date()),
      },
    });
    if (expired.length === 0) return;

    this.logger.log(`Auto-resolviendo ${expired.length} propuestas vencidas`);

    for (const proposal of expired) {
      try {
        const ordered = [...proposal.candidates].sort(
          (a, b) => a.priority - b.priority,
        );
        const kept = ordered.slice(0, proposal.cap);
        const dropped = ordered.slice(proposal.cap);
        const materialized = await this.materializeCandidates(
          kept,
          proposal.user.id,
        );

        proposal.status = ProposalStatus.AUTO_RESOLVED;
        proposal.resolvedAt = new Date();
        await this.proposalsRepo.save(proposal);

        void this.notifications.materializationAutoResolved(
          proposal.user.id,
          proposal.user.email,
          proposal.user.firstName,
          proposal.month,
          materialized,
          dropped.length,
        );
      } catch (e) {
        this.logger.error(
          `Error auto-resolviendo propuesta ${proposal.id}: ${(e as Error).message}`,
        );
      }
    }
  }

  /**
   * Materializa una lista de candidatos: crea bookings asociados a su recurring,
   * respetando nivel, no-duplicado, capacidad, no-pasado. Devuelve cuántos se crearon.
   */
  private async materializeCandidates(
    candidates: ProposalCandidate[],
    userId: string,
  ): Promise<number> {
    if (candidates.length === 0) return 0;

    const scheduleIds = candidates.map((c) => c.scheduleId);
    const recurringIds = Array.from(
      new Set(candidates.map((c) => c.recurringId)),
    );

    const [schedules, recurrings] = await Promise.all([
      this.schedulesRepo.find({ where: { id: In(scheduleIds) } }),
      this.recurringRepo.find({
        where: { id: In(recurringIds), isActive: true },
      }),
    ]);
    const schedulesById = new Map(schedules.map((s) => [s.id, s]));
    const recurringsById = new Map(recurrings.map((r) => [r.id, r]));

    let created = 0;
    for (const cand of candidates) {
      const schedule = schedulesById.get(cand.scheduleId);
      const recurring = recurringsById.get(cand.recurringId);
      if (!schedule || !recurring) continue;
      if (schedule.isCancelled) continue;
      if (this.getScheduleStart(schedule).getTime() <= Date.now()) continue;
      if (!canTakeLevel(recurring.user.level, schedule.pilatesClass.level))
        continue;
      if (schedule.enrolledCount >= schedule.maxCapacity) continue;

      const existing = await this.bookingsRepo.findOne({
        where: {
          user: { id: userId },
          schedule: { id: schedule.id },
          status: In([
            BookingStatus.CONFIRMED,
            BookingStatus.PENDING_CONFIRMATION,
            BookingStatus.WAITLIST,
          ]),
        },
      });
      if (existing) continue;

      const conflict = await hasTimeConflict(
        this.bookingsRepo,
        userId,
        schedule.date,
        schedule.startTime,
        schedule.endTime,
      );
      if (conflict) continue;

      const booking = this.bookingsRepo.create({
        user: { id: userId },
        schedule,
        status: BookingStatus.CONFIRMED,
        recurringBooking: recurring,
      });
      await this.bookingsRepo.save(booking);
      await this.schedulesRepo.increment(
        { id: schedule.id },
        'enrolledCount',
        1,
      );
      await this.schedulesRepo.update({ id: schedule.id }, { emptyAt: null });
      created++;
    }
    return created;
  }

  private getScheduleStart(schedule: Schedule): Date {
    const time = schedule.startTime.substring(0, 5);
    return new Date(`${schedule.date}T${time}:00`);
  }
}
