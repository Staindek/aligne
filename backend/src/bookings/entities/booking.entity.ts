import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Schedule } from '../../schedules/entities/schedule.entity';
import { RecurringBooking } from './recurring-booking.entity';

export enum BookingStatus {
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  WAITLIST = 'waitlist',
  PENDING_CONFIRMATION = 'pending_confirmation',
}

export enum AttendanceStatus {
  PENDING = 'pending',
  PRESENT = 'present',
  ABSENT = 'absent',
}

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn()
  user: User;

  @ManyToOne(() => Schedule, { eager: true })
  @JoinColumn()
  schedule: Schedule;

  @Column({
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.CONFIRMED,
  })
  status: BookingStatus;

  @Column({ nullable: true })
  cancelledAt: Date;

  @Column({ nullable: true })
  confirmationDeadline: Date;

  @Column({
    type: 'enum',
    enum: AttendanceStatus,
    default: AttendanceStatus.PENDING,
  })
  attendanceStatus: AttendanceStatus;

  @Column({ type: 'timestamp', nullable: true })
  attendanceMarkedAt: Date | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  attendanceMarkedBy: User | null;

  @ManyToOne(() => RecurringBooking, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  recurringBooking: RecurringBooking | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
