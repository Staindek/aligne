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
import { Pack } from '../../packs/entities/pack.entity';

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn()
  user: User;

  @ManyToOne(() => Pack, { eager: true, nullable: true })
  @JoinColumn()
  pack: Pack | null;

  @Column()
  month: string; // formato 'YYYY-MM'

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ nullable: true })
  mpPaymentId: string;

  @Column({ nullable: true })
  mpPreferenceId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  amount: number;

  // Crédito (en pesos) que este pago consumió del User.credit al crearse.
  // Si el pago FAILED, este monto se devuelve al User.credit.
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  creditApplied: number;

  @Column({ nullable: true })
  paidAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
