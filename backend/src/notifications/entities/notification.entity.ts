import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum NotificationType {
  PAYMENT_PENDING = 'payment_pending',
  PAYMENT_CONFIRMED = 'payment_confirmed',
  CLASS_CREATED = 'class_created',
  CLASS_CANCELLED = 'class_cancelled',
  SPOT_OPENED = 'spot_opened',
  WAITLIST_PROMOTION = 'waitlist_promotion',
  WAITLIST_EXPIRED = 'waitlist_expired',
  FIFTH_CLASS_WARNING = 'fifth_class_warning',
  NO_SHOW_WARNING = 'no_show_warning',
  CLASS_AUTO_CANCELLED = 'class_auto_cancelled',
  MATERIALIZATION_PENDING = 'materialization_pending',
  MATERIALIZATION_AUTO_RESOLVED = 'materialization_auto_resolved',
}

@Entity('notifications')
@Index(['user', 'isRead', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column()
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ nullable: true })
  link: string;

  @Column({ default: false })
  isRead: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
