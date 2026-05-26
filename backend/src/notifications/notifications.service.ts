import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
}

interface PersistArgs {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
  ) {}

  send(payload: EmailPayload): Promise<void> {
    // En producción: reemplazar con Nodemailer + SMTP / Expo Push para mobile.
    // Por ahora solo loguea — será realmente async cuando se sume el transporte SMTP.
    this.logger.log(
      `[EMAIL] Para: ${payload.to} | Asunto: ${payload.subject}\n${payload.text}`,
    );
    return Promise.resolve();
  }

  private async persist(args: PersistArgs): Promise<void> {
    const notification = this.notificationsRepository.create({
      user: { id: args.userId },
      type: args.type,
      title: args.title,
      body: args.body,
      link: args.link,
    });
    await this.notificationsRepository.save(notification);
  }

  async paymentPending(
    userId: string,
    email: string,
    firstName: string,
    month: string,
  ): Promise<void> {
    const [year, m] = month.split('-');
    const monthName = new Date(Number(year), Number(m) - 1).toLocaleString(
      'es-AR',
      { month: 'long' },
    );
    const title = `Pago pendiente para ${monthName} ${year}`;
    const body = `Tu pago de ${monthName} ${year} está pendiente. Completalo para reservar tus clases.`;
    await Promise.all([
      this.persist({
        userId,
        type: NotificationType.PAYMENT_PENDING,
        title,
        body,
        link: '/student/payments',
      }),
      this.send({
        to: email,
        subject: `Aligné — ${title}`,
        text: `Hola ${firstName},\n\n${body}\n\nAligné Studio`,
      }),
    ]);
  }

  async paymentConfirmed(
    userId: string,
    email: string,
    firstName: string,
    month: string,
  ): Promise<void> {
    const [year, m] = month.split('-');
    const monthName = new Date(Number(year), Number(m) - 1).toLocaleString(
      'es-AR',
      { month: 'long' },
    );
    const title = `Pago confirmado para ${monthName} ${year}`;
    const body = `¡Tu pago de ${monthName} ${year} fue confirmado! Ya podés reservar tus 4 clases del mes.`;
    await Promise.all([
      this.persist({
        userId,
        type: NotificationType.PAYMENT_CONFIRMED,
        title,
        body,
        link: '/student/classes',
      }),
      this.send({
        to: email,
        subject: `Aligné — ${title}`,
        text: `Hola ${firstName},\n\n${body}\n\nAligné Studio`,
      }),
    ]);
  }

  async waitlistPromotion(
    userId: string,
    email: string,
    firstName: string,
    className: string,
    date: string,
    startTime: string,
    confirmUrl: string,
    deadline: Date,
  ): Promise<void> {
    const deadlineStr = deadline.toLocaleString('es-AR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
    const title = `¡Se liberó un lugar en ${className}!`;
    const body = `Se liberó un lugar en la clase de ${className} del ${date} a las ${startTime}. Confirmá antes del ${deadlineStr} o el lugar pasará a la siguiente persona.`;
    await Promise.all([
      this.persist({
        userId,
        type: NotificationType.WAITLIST_PROMOTION,
        title,
        body,
        link: '/student/bookings',
      }),
      this.send({
        to: email,
        subject: `Aligné — ${title}`,
        text: `Hola ${firstName},\n\n${body}\n\n${confirmUrl}\n\nAligné Studio`,
      }),
    ]);
  }

  async waitlistExpired(
    userId: string,
    email: string,
    firstName: string,
    className: string,
  ): Promise<void> {
    const title = `El lugar en ${className} pasó a otra alumnx`;
    const body = `El tiempo para confirmar tu lugar en ${className} venció. El lugar pasó a la siguiente persona en lista.`;
    await Promise.all([
      this.persist({
        userId,
        type: NotificationType.WAITLIST_EXPIRED,
        title,
        body,
        link: '/student/bookings',
      }),
      this.send({
        to: email,
        subject: `Aligné — ${title}`,
        text: `Hola ${firstName},\n\n${body}\n\nAligné Studio`,
      }),
    ]);
  }

  async classCreated(
    userId: string,
    email: string,
    firstName: string,
    className: string,
    date: string,
    startTime: string,
    instructorName: string,
  ): Promise<void> {
    const title = `Nueva clase: ${className} el ${date}`;
    const body = `Se agendó una nueva clase de ${className} con ${instructorName} el ${date} a las ${startTime}.`;
    await Promise.all([
      this.persist({
        userId,
        type: NotificationType.CLASS_CREATED,
        title,
        body,
        link: '/student/classes',
      }),
      this.send({
        to: email,
        subject: `Aligné — ${title}`,
        text: `Hola ${firstName},\n\n${body}\n\nIngresá a la app para reservar tu lugar.\n\nAligné Studio`,
      }),
    ]);
  }

  async classCancelled(
    userId: string,
    email: string,
    firstName: string,
    className: string,
    date: string,
    startTime: string,
  ): Promise<void> {
    const title = `Clase cancelada: ${className} el ${date}`;
    const body = `La clase de ${className} del ${date} a las ${startTime} fue cancelada. Tu reserva fue cancelada automáticamente y la clase no se cuenta dentro de tu plan mensual.`;
    await Promise.all([
      this.persist({
        userId,
        type: NotificationType.CLASS_CANCELLED,
        title,
        body,
        link: '/student/bookings',
      }),
      this.send({
        to: email,
        subject: `Aligné — ${title}`,
        text: `Hola ${firstName},\n\n${body}\n\nLamentamos el inconveniente.\n\nAligné Studio`,
      }),
    ]);
  }

  async spotOpened(
    userId: string,
    email: string,
    firstName: string,
    className: string,
    date: string,
    startTime: string,
    bookUrl: string,
  ): Promise<void> {
    const title = `Se liberó un lugar en ${className}`;
    const body = `Se liberó un lugar en la clase de ${className} del ${date} a las ${startTime}.`;
    await Promise.all([
      this.persist({
        userId,
        type: NotificationType.SPOT_OPENED,
        title,
        body,
        link: '/student/classes',
      }),
      this.send({
        to: email,
        subject: `Aligné — ${title}`,
        text: `Hola ${firstName},\n\n${body}\n\nReservá tu lugar antes de que se llene:\n${bookUrl}\n\nAligné Studio`,
      }),
    ]);
  }

  async noShowWarning(
    userId: string,
    email: string,
    firstName: string,
    count: number,
    month: string,
  ): Promise<void> {
    const [year, m] = month.split('-');
    const monthName = new Date(Number(year), Number(m) - 1).toLocaleString(
      'es-AR',
      { month: 'long' },
    );
    const title = `Tenés ${count} faltas este mes`;
    const body = `Registramos ${count} faltas en clases reservadas durante ${monthName} ${year}. Para no afectar tu plan, cancelá tus reservas con al menos 4 horas de anticipación si no podés asistir.`;
    await Promise.all([
      this.persist({
        userId,
        type: NotificationType.NO_SHOW_WARNING,
        title,
        body,
        link: '/student/bookings',
      }),
      this.send({
        to: email,
        subject: `Aligné — ${title}`,
        text: `Hola ${firstName},\n\n${body}\n\nAligné Studio`,
      }),
    ]);
  }

  async fifthClassWarning(
    userId: string,
    email: string,
    firstName: string,
    month: string,
  ): Promise<void> {
    const [year, m] = month.split('-');
    const monthName = new Date(Number(year), Number(m) - 1).toLocaleString(
      'es-AR',
      { month: 'long' },
    );
    const title = `Límite de clases alcanzado en ${monthName}`;
    const body = `Alcanzaste el límite de 4 clases de tu plan para ${monthName} ${year}.`;
    await Promise.all([
      this.persist({
        userId,
        type: NotificationType.FIFTH_CLASS_WARNING,
        title,
        body,
      }),
      this.send({
        to: email,
        subject: `Aligné — ${title}`,
        text: `Hola ${firstName},\n\n${body}\n\nSi necesitás más clases este mes, contactate con el estudio.\n\nAligné Studio`,
      }),
    ]);
  }

  /**
   * Auto-cancel de una clase vacía. Avisa a la instructora.
   * `instructorUserId` es opcional: si la instructora tiene cuenta de User,
   * persistimos también la notificación in-app. Si no, solo email.
   */
  async classAutoCancelled(args: {
    instructorEmail: string;
    instructorFirstName: string;
    instructorUserId?: string;
    className: string;
    date: string;
    startTime: string;
  }): Promise<void> {
    const title = `Clase cancelada: ${args.className} el ${args.date}`;
    const body = `La clase de ${args.className} del ${args.date} a las ${args.startTime} quedó sin alumnxs anotadxs y se canceló automáticamente. No hace falta que vayas al estudio.`;
    const tasks: Promise<unknown>[] = [
      this.send({
        to: args.instructorEmail,
        subject: `Aligné — ${title}`,
        text: `Hola ${args.instructorFirstName},\n\n${body}\n\nAligné Studio`,
      }),
    ];
    if (args.instructorUserId) {
      tasks.push(
        this.persist({
          userId: args.instructorUserId,
          type: NotificationType.CLASS_AUTO_CANCELLED,
          title,
          body,
          link: '/instructor/sessions',
        }),
      );
    }
    await Promise.all(tasks);
  }

  async materializationPending(
    userId: string,
    email: string,
    firstName: string,
    month: string,
    candidateCount: number,
    cap: number,
    proposalId: string,
  ): Promise<void> {
    const [year, m] = month.split('-');
    const monthName = new Date(Number(year), Number(m) - 1).toLocaleString(
      'es-AR',
      { month: 'long' },
    );
    const title = `Elegí tus fijas de ${monthName}`;
    const body = `Tenés ${candidateCount} clases fijas para ${monthName} ${year} y tu pack permite ${cap}. Entrá a elegir cuáles materializar — si no respondés en 24hs, dejamos las fijas más antiguas.`;
    await Promise.all([
      this.persist({
        userId,
        type: NotificationType.MATERIALIZATION_PENDING,
        title,
        body,
        link: `/student/recurring/picks/${proposalId}`,
      }),
      this.send({
        to: email,
        subject: `Aligné — ${title}`,
        text: `Hola ${firstName},\n\n${body}\n\nAligné Studio`,
      }),
    ]);
  }

  async materializationAutoResolved(
    userId: string,
    email: string,
    firstName: string,
    month: string,
    materialized: number,
    dropped: number,
  ): Promise<void> {
    const [year, m] = month.split('-');
    const monthName = new Date(Number(year), Number(m) - 1).toLocaleString(
      'es-AR',
      { month: 'long' },
    );
    const title = `Tus fijas de ${monthName} están listas`;
    const body = `Como no respondiste a tiempo, materializamos ${materialized} clases priorizando tus fijas más antiguas. ${dropped > 0 ? `Quedaron ${dropped} afuera del mes.` : ''}`;
    await Promise.all([
      this.persist({
        userId,
        type: NotificationType.MATERIALIZATION_AUTO_RESOLVED,
        title,
        body,
        link: '/student/bookings',
      }),
      this.send({
        to: email,
        subject: `Aligné — ${title}`,
        text: `Hola ${firstName},\n\n${body}\n\nAligné Studio`,
      }),
    ]);
  }

  // Lectura para el feed in-app
  findMyNotifications(userId: string, limit = 50): Promise<Notification[]> {
    return this.notificationsRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  countUnread(userId: string): Promise<number> {
    return this.notificationsRepository.count({
      where: { user: { id: userId }, isRead: false },
    });
  }

  async markRead(id: string, userId: string): Promise<void> {
    await this.notificationsRepository.update(
      { id, user: { id: userId } },
      { isRead: true },
    );
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notificationsRepository.update(
      { user: { id: userId }, isRead: false },
      { isRead: true },
    );
  }
}
