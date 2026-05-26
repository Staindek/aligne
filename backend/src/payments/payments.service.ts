import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import MercadoPagoConfig, {
  Preference,
  Payment as MpPayment,
} from 'mercadopago';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { Pack } from '../packs/entities/pack.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { RecurringBookingsService } from '../bookings/recurring-bookings.service';

// Día tope para abonar el mes corriente
const PAYMENT_DEADLINE_DAY = 10;

export interface MonthPaymentSummary {
  month: string;
  effectivePack: Pack | null;
  classLimit: number | null; // null = ilimitado, undefined ya no se usa
  totalPaid: number;
  userCredit: number; // crédito en pesos disponible
  userClassCredit: number; // crédito en clases para `userClassCreditMonth`
  userClassCreditMonth: string | null;
  payments: Payment[];
}

@Injectable()
export class PaymentsService {
  private readonly mpClient: MercadoPagoConfig;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Pack)
    private readonly packsRepository: Repository<Pack>,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    @Inject(forwardRef(() => RecurringBookingsService))
    private readonly recurringBookings: RecurringBookingsService,
  ) {
    this.mpClient = new MercadoPagoConfig({
      accessToken: this.config.get<string>('MP_ACCESS_TOKEN') ?? '',
    });
  }

  currentMonth(): string {
    return new Date().toISOString().substring(0, 7);
  }

  /**
   * Devuelve al User.credit el creditApplied de un Payment que pasa a FAILED.
   * Idempotente: pone creditApplied = 0 después.
   */
  private async refundCreditIfNeeded(payment: Payment): Promise<void> {
    const applied = Number(payment.creditApplied ?? 0);
    if (applied <= 0) return;
    const user = await this.usersRepository.findOne({
      where: { id: payment.user.id },
    });
    if (!user) return;
    user.credit = Number(user.credit ?? 0) + applied;
    await this.usersRepository.save(user);
    payment.creditApplied = 0;
  }

  /**
   * `isUpgrade`: si ya tiene pack PAID este mes y está pagando uno mayor, no aplica el deadline
   * (el deadline solo bloquea la cuota fija inicial del mes).
   */
  private assertCanPayMonth(month: string, isUpgrade = false): void {
    if (month < this.currentMonth()) {
      throw new BadRequestException('No se puede pagar un mes pasado');
    }
    if (month !== this.currentMonth()) return; // pagos de meses futuros sin tope
    if (isUpgrade) return; // upgrade habilitado todo el mes
    const today = new Date().getDate();
    if (today > PAYMENT_DEADLINE_DAY) {
      throw new BadRequestException(
        `El plazo para abonar la cuota de este mes era hasta el día ${PAYMENT_DEADLINE_DAY}. Podés esperar al 1 del mes que viene o, si ya tenés pack este mes, hacer un upgrade.`,
      );
    }
  }

  /**
   * `faltan <= 15 días para que termine `month`` → crédito en clases en vez de en plata.
   */
  private isWithin15DaysOfMonthEnd(month: string): boolean {
    const [y, m] = month.split('-').map(Number);
    const monthEnd = new Date(y, m, 0); // último día del mes
    monthEnd.setHours(23, 59, 59, 999);
    const msToEnd = monthEnd.getTime() - Date.now();
    if (msToEnd < 0) return false; // mes ya pasó
    const daysToEnd = msToEnd / (1000 * 60 * 60 * 24);
    return daysToEnd <= 15;
  }

  private nextMonth(month: string): string {
    const [y, m] = month.split('-').map(Number);
    const ny = m === 12 ? y + 1 : y;
    const nm = m === 12 ? 1 : m + 1;
    return `${ny}-${String(nm).padStart(2, '0')}`;
  }

  // Pack "efectivo" del mes = el de mayor classCount entre los pagos PAID
  // (null en classCount = ilimitado, gana siempre)
  private pickEffectivePack(payments: Payment[]): Pack | null {
    const paid = payments.filter(
      (p) => p.status === PaymentStatus.PAID && p.pack,
    );
    if (paid.length === 0) return null;
    return paid.reduce((best, cur) => {
      if (!best.pack) return best;
      if (!cur.pack) return cur;
      // null classCount = ilimitado
      if (cur.pack.classCount === null) return cur;
      if (best.pack.classCount === null) return best;
      return cur.pack.classCount > best.pack.classCount ? cur : best;
    }).pack;
  }

  async getMonthSummary(
    userId: string,
    month?: string,
  ): Promise<MonthPaymentSummary> {
    const m = month ?? this.currentMonth();
    const [user, payments] = await Promise.all([
      this.usersRepository.findOne({ where: { id: userId } }),
      this.paymentsRepository.find({
        where: { user: { id: userId }, month: m },
        order: { createdAt: 'ASC' },
      }),
    ]);
    const effectivePack = this.pickEffectivePack(payments);
    const totalPaid = payments
      .filter((p) => p.status === PaymentStatus.PAID)
      .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
    return {
      month: m,
      effectivePack,
      classLimit: effectivePack ? (effectivePack.classCount ?? null) : 0,
      totalPaid,
      userCredit: Number(user?.credit ?? 0),
      userClassCredit: Number(user?.classCredit ?? 0),
      userClassCreditMonth: user?.classCreditMonth ?? null,
      payments,
    };
  }

  // Para BookingsService: devuelve el límite mensual del usuario.
  // - número > 0  → tope de clases
  // - null        → ilimitado (Pase libre)
  // - 0           → sin pack pago (no puede reservar)
  async getMonthClassLimit(
    userId: string,
    month?: string,
  ): Promise<number | null> {
    const summary = await this.getMonthSummary(userId, month);
    return summary.classLimit;
  }

  /**
   * Para validar nuevas reservas: cap del mes considerando PAID, PENDING y classCredit.
   * - hasPaid: hay un pack PAID o classCredit válido (puede reservar mes corriente)
   * - cap: tope de reservas (null = ilimitado, 0 = sin pack ni crédito → bloquear)
   */
  async getMonthBookingCap(
    userId: string,
    month?: string,
  ): Promise<{ hasPaid: boolean; cap: number | null }> {
    const m = month ?? this.currentMonth();
    const summary = await this.getMonthSummary(userId, m);

    // classCredit aplicable a este mes (si la columna apunta a este mes)
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    const classCredit =
      user?.classCreditMonth === m ? Number(user.classCredit ?? 0) : 0;

    if (summary.effectivePack) {
      const base = summary.effectivePack.classCount;
      const cap = base === null ? null : base + classCredit;
      return { hasPaid: true, cap };
    }

    const pendingPacks = summary.payments
      .filter((p) => p.status === PaymentStatus.PENDING && p.pack)
      .map((p) => p.pack!);

    if (pendingPacks.length === 0) {
      // Sin pack alguno: si hay classCredit para este mes, la alumnx puede reservar hasta ese cap
      if (classCredit > 0) return { hasPaid: true, cap: classCredit };
      return { hasPaid: false, cap: 0 };
    }

    const best = pendingPacks.reduce((bestPack, cur) => {
      if (cur.classCount === null) return cur;
      if (bestPack.classCount === null) return bestPack;
      return cur.classCount > bestPack.classCount ? cur : bestPack;
    });
    const base = best.classCount;
    const cap = base === null ? null : base + classCredit;
    return { hasPaid: false, cap };
  }

  async initiatePackPayment(
    userId: string,
    packId: string,
    monthOpt?: string,
  ): Promise<Payment> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const pack = await this.packsRepository.findOne({ where: { id: packId } });
    if (!pack || !pack.isActive)
      throw new NotFoundException('Pack no encontrado o inactivo');

    const month = monthOpt ?? this.currentMonth();
    const summary = await this.getMonthSummary(userId, month);

    let isUpgrade = false;
    if (summary.effectivePack) {
      const current = summary.effectivePack;
      const currentRank = current.classCount ?? Number.POSITIVE_INFINITY;
      const newRank = pack.classCount ?? Number.POSITIVE_INFINITY;
      if (newRank <= currentRank) {
        throw new BadRequestException(
          `Ya tenés ${current.name} pagado este mes. Usá "Cambiar pack" para bajar.`,
        );
      }
      isUpgrade = true;
    }
    this.assertCanPayMonth(month, isUpgrade);

    // Reusar pending del mismo pack
    const reusable = summary.payments.find(
      (p) => p.status === PaymentStatus.PENDING && p.pack?.id === pack.id,
    );
    if (reusable) {
      return reusable;
    }

    // Cancelar otros pending de otros packs del mismo mes (cambio de pack pendiente)
    const otherPendings = summary.payments.filter(
      (p) => p.status === PaymentStatus.PENDING && p.pack?.id !== pack.id,
    );
    for (const p of otherPendings) {
      p.status = PaymentStatus.FAILED;
      await this.refundCreditIfNeeded(p);
      await this.paymentsRepository.save(p);
    }
    // Re-leer user porque refundCreditIfNeeded actualizó el crédito
    const freshUser =
      otherPendings.length > 0
        ? await this.usersRepository.findOne({ where: { id: userId } })
        : user;
    if (!freshUser) throw new NotFoundException('Usuario no encontrado');

    // Calcular monto y crédito aplicable
    const alreadyPaid = summary.effectivePack ? summary.totalPaid : 0;
    const owed = Math.max(0, Number(pack.price) - alreadyPaid);
    const availableCredit = Number(freshUser.credit ?? 0);
    const creditToApply = Math.min(availableCredit, owed);
    const amount = owed - creditToApply;

    if (creditToApply > 0) {
      freshUser.credit = availableCredit - creditToApply;
      await this.usersRepository.save(freshUser);
    }

    const payment = this.paymentsRepository.create({
      user: freshUser,
      pack,
      month,
      status: PaymentStatus.PENDING,
      amount,
      creditApplied: creditToApply,
    });
    return this.paymentsRepository.save(payment);
  }

  /**
   * Cambia el pack efectivo de un mes ya pagado por uno menor.
   * - Si faltan ≤15 días para el cierre del mes Y ambos packs son finitos:
   *   crédito en CLASES (oldClassCount - newClassCount), aplicable al mes siguiente.
   * - En cualquier otro caso: crédito en PLATA (diferencia entre pagado y nuevo precio).
   */
  async changePackForPaidMonth(
    userId: string,
    newPackId: string,
    monthOpt?: string,
  ): Promise<{
    payment: Payment;
    creditType: 'money' | 'classes';
    creditAdded: number;
    creditTargetMonth: string | null;
    userCredit: number;
    userClassCredit: number;
    userClassCreditMonth: string | null;
  }> {
    const month = monthOpt ?? this.currentMonth();
    if (month < this.currentMonth()) {
      throw new BadRequestException('No se puede modificar un mes pasado');
    }

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const newPack = await this.packsRepository.findOne({
      where: { id: newPackId },
    });
    if (!newPack || !newPack.isActive)
      throw new NotFoundException('Pack no encontrado o inactivo');

    const summary = await this.getMonthSummary(userId, month);
    if (!summary.effectivePack) {
      throw new BadRequestException(
        'No hay pack pago en este mes para cambiar',
      );
    }

    const oldPack = summary.effectivePack;
    const currentRank = oldPack.classCount ?? Number.POSITIVE_INFINITY;
    const newRank = newPack.classCount ?? Number.POSITIVE_INFINITY;
    if (newRank >= currentRank) {
      throw new BadRequestException(
        `Para subir de pack usá "Upgradear" desde la sección de packs.`,
      );
    }

    // El pago a mutar = el de mayor rank entre los PAID
    const paidPayments = summary.payments.filter(
      (p) => p.status === PaymentStatus.PAID && p.pack,
    );
    const targetPayment = paidPayments.reduce<Payment>((best, cur) => {
      const bestRank = best.pack!.classCount ?? Number.POSITIVE_INFINITY;
      const curRank = cur.pack!.classCount ?? Number.POSITIVE_INFINITY;
      return curRank > bestRank ? cur : best;
    }, paidPayments[0]);

    targetPayment.pack = newPack;
    await this.paymentsRepository.save(targetPayment);

    // Decidir tipo de crédito
    const bothFinite =
      oldPack.classCount !== null && newPack.classCount !== null;
    const within15 = this.isWithin15DaysOfMonthEnd(month);

    if (within15 && bothFinite) {
      // Crédito en CLASES para el mes siguiente
      const classDiff = oldPack.classCount! - newPack.classCount!;
      const targetMonth = this.nextMonth(month);
      // Si ya tenía classCredit apuntando a otro mes, lo movemos al más reciente
      // (o sumamos si ya apuntaba al mismo target)
      if (user.classCreditMonth === targetMonth) {
        user.classCredit = Number(user.classCredit ?? 0) + classDiff;
      } else {
        user.classCredit = classDiff;
        user.classCreditMonth = targetMonth;
      }
      await this.usersRepository.save(user);
      return {
        payment: targetPayment,
        creditType: 'classes',
        creditAdded: classDiff,
        creditTargetMonth: targetMonth,
        userCredit: Number(user.credit ?? 0),
        userClassCredit: Number(user.classCredit ?? 0),
        userClassCreditMonth: user.classCreditMonth,
      };
    }

    // Crédito en PLATA
    const newPackPrice = Number(newPack.price);
    const moneyAdded = Math.max(0, summary.totalPaid - newPackPrice);
    if (moneyAdded > 0) {
      user.credit = Number(user.credit ?? 0) + moneyAdded;
      await this.usersRepository.save(user);
    }
    return {
      payment: targetPayment,
      creditType: 'money',
      creditAdded: moneyAdded,
      creditTargetMonth: null,
      userCredit: Number(user.credit ?? 0),
      userClassCredit: Number(user.classCredit ?? 0),
      userClassCreditMonth: user.classCreditMonth,
    };
  }

  async findMyPayments(userId: string): Promise<Payment[]> {
    return this.paymentsRepository.find({
      where: { user: { id: userId } },
      order: { month: 'DESC', createdAt: 'DESC' },
    });
  }

  async findAll(): Promise<Payment[]> {
    return this.paymentsRepository.find({
      order: { month: 'DESC', createdAt: 'DESC' },
    });
  }

  async adminCreate(dto: CreatePaymentDto): Promise<Payment> {
    // Admin registra pagos manualmente; el deadline del día 10 solo aplica al alumnx
    if (dto.month < this.currentMonth()) {
      throw new BadRequestException(
        'No se puede registrar un pago para un mes pasado',
      );
    }
    const user = await this.usersRepository.findOne({
      where: { id: dto.userId },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const pack = await this.packsRepository.findOne({
      where: { id: dto.packId },
    });
    if (!pack) throw new NotFoundException('Pack no encontrado');
    const payment = this.paymentsRepository.create({
      user,
      pack,
      month: dto.month,
      status: PaymentStatus.PENDING,
      amount: Number(pack.price),
    });
    return this.paymentsRepository.save(payment);
  }

  async adminMarkPaid(id: string): Promise<Payment> {
    const payment = await this.paymentsRepository.findOne({ where: { id } });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    const wasPaid = payment.status === PaymentStatus.PAID;
    payment.status = PaymentStatus.PAID;
    payment.paidAt = new Date();
    const saved = await this.paymentsRepository.save(payment);
    await this.notifications.paymentConfirmed(
      saved.user.id,
      saved.user.email,
      saved.user.firstName,
      saved.month,
    );
    if (!wasPaid) {
      void this.recurringBookings.materializeForUserMonth(
        saved.user.id,
        saved.month,
      );
    }
    return saved;
  }

  async createCheckout(
    paymentId: string,
    userId: string,
  ): Promise<{ checkoutUrl: string }> {
    const payment = await this.paymentsRepository.findOne({
      where: { id: paymentId, user: { id: userId } },
    });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    if (payment.status === PaymentStatus.PAID)
      throw new BadRequestException('Este pago ya fue realizado');
    if (!payment.pack)
      throw new BadRequestException('El pago no tiene pack asignado');

    const mpToken = this.config.get<string>('MP_ACCESS_TOKEN') ?? '';
    if (!mpToken || mpToken.startsWith('TEST-your-')) {
      throw new BadRequestException(
        'Mercado Pago no está configurado todavía. Pedile al estudio que confirme el pago manualmente desde Pagos del admin.',
      );
    }

    const appUrl =
      this.config.get<string>('APP_URL') ?? 'http://localhost:3001';
    const apiUrl =
      this.config.get<string>('API_URL') ?? 'http://localhost:3000';
    const [year, m] = payment.month.split('-');
    const monthName = new Date(Number(year), Number(m) - 1).toLocaleString(
      'es-AR',
      { month: 'long' },
    );
    const price = Number(payment.amount ?? payment.pack.price);

    try {
      const preference = new Preference(this.mpClient);
      const result = await preference.create({
        body: {
          items: [
            {
              id: payment.id,
              title: `Aligné — ${payment.pack.name} (${monthName} ${year})`,
              quantity: 1,
              unit_price: price,
              currency_id: this.config.get<string>('MP_PLAN_CURRENCY') ?? 'ARS',
            },
          ],
          back_urls: {
            success: `${appUrl}/payment/success?payment_id=${payment.id}`,
            failure: `${appUrl}/payment/failure?payment_id=${payment.id}`,
            pending: `${appUrl}/payment/pending?payment_id=${payment.id}`,
          },
          auto_return: 'approved',
          notification_url: `${apiUrl}/api/v1/payments/webhook`,
          external_reference: payment.id,
        },
      });

      payment.mpPreferenceId = result.id ?? '';
      await this.paymentsRepository.save(payment);
      return { checkoutUrl: result.init_point ?? '' };
    } catch (err: unknown) {
      throw new BadRequestException(
        `No se pudo iniciar el pago con Mercado Pago: ${
          err instanceof Error ? err.message : 'error desconocido'
        }`,
      );
    }
  }

  async handleWebhook(body: Record<string, unknown>): Promise<void> {
    const type = body.type as string;
    const dataId = (body.data as Record<string, string>)?.id;
    if (type !== 'payment' || !dataId) return;
    try {
      const mpPayment = new MpPayment(this.mpClient);
      const mpData = await mpPayment.get({ id: dataId });
      const externalRef = mpData.external_reference;
      if (!externalRef) return;
      const payment = await this.paymentsRepository.findOne({
        where: { id: externalRef },
      });
      if (!payment) return;
      payment.mpPaymentId = dataId;
      if (mpData.status === 'approved') {
        const wasPaid = payment.status === PaymentStatus.PAID;
        payment.status = PaymentStatus.PAID;
        payment.paidAt = new Date();
        await this.paymentsRepository.save(payment);
        await this.notifications.paymentConfirmed(
          payment.user.id,
          payment.user.email,
          payment.user.firstName,
          payment.month,
        );
        if (!wasPaid) {
          void this.recurringBookings.materializeForUserMonth(
            payment.user.id,
            payment.month,
          );
        }
      } else if (mpData.status === 'rejected') {
        payment.status = PaymentStatus.FAILED;
        await this.refundCreditIfNeeded(payment);
        await this.paymentsRepository.save(payment);
      } else {
        await this.paymentsRepository.save(payment);
      }
    } catch {
      // MP reintentará
    }
  }

  async verifyByPreference(
    paymentId: string,
    userId: string,
  ): Promise<Payment> {
    const payment = await this.paymentsRepository.findOne({
      where: { id: paymentId, user: { id: userId } },
    });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    if (!payment.mpPreferenceId || payment.status === PaymentStatus.PAID)
      return payment;
    try {
      const preference = new Preference(this.mpClient);
      const result = await preference.get({
        preferenceId: payment.mpPreferenceId,
      });
      if (payment.mpPaymentId) {
        const mpPayment = new MpPayment(this.mpClient);
        const mpData = await mpPayment.get({ id: payment.mpPaymentId });
        if (
          mpData.status === 'approved' &&
          (payment.status as PaymentStatus) !== PaymentStatus.PAID
        ) {
          payment.status = PaymentStatus.PAID;
          payment.paidAt = new Date();
          await this.paymentsRepository.save(payment);
          await this.notifications.paymentConfirmed(
            payment.user.id,
            payment.user.email,
            payment.user.firstName,
            payment.month,
          );
          void this.recurringBookings.materializeForUserMonth(
            payment.user.id,
            payment.month,
          );
        }
      }
      void result;
    } catch {
      // No bloquear si MP falla
    }
    return payment;
  }

  async isCurrentMonthPaid(userId: string): Promise<boolean> {
    const summary = await this.getMonthSummary(userId);
    return summary.effectivePack !== null;
  }

  async findPaidStudentsForMonth(month: string): Promise<User[]> {
    const payments = await this.paymentsRepository.find({
      where: { month, status: PaymentStatus.PAID },
    });
    const map = new Map<string, User>();
    for (const p of payments) {
      if (p.user && p.user.role === UserRole.STUDENT)
        map.set(p.user.id, p.user);
    }
    return Array.from(map.values());
  }
}
