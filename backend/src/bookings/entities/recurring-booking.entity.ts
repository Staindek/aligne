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
import { PilatesClass } from '../../classes/entities/class.entity';

@Entity('recurring_bookings')
export class RecurringBooking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @ManyToOne(() => PilatesClass, { eager: true })
  @JoinColumn()
  pilatesClass: PilatesClass;

  @Column({ type: 'int' })
  dayOfWeek: number; // 0=Domingo, 1=Lunes, ..., 6=Sábado

  @Column({ type: 'time' })
  startTime: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
