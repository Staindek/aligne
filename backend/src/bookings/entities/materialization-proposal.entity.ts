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

export enum ProposalStatus {
  PENDING = 'pending',
  RESOLVED = 'resolved',
  AUTO_RESOLVED = 'auto_resolved',
  CANCELLED = 'cancelled',
}

// Candidato a materializar: schedule + recurring que lo origina + prioridad (createdAt del recurring en ms)
export interface ProposalCandidate {
  scheduleId: string;
  recurringId: string;
  priority: number;
}

@Entity('materialization_proposals')
@Index(['user', 'month', 'status'])
export class MaterializationProposal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: true })
  @JoinColumn()
  user: User;

  @Column({ type: 'varchar', length: 7 })
  month: string;

  @Column({
    type: 'enum',
    enum: ProposalStatus,
    default: ProposalStatus.PENDING,
  })
  status: ProposalStatus;

  @Column({ type: 'int' })
  cap: number;

  @Column({ type: 'jsonb' })
  candidates: ProposalCandidate[];

  @Column({ type: 'timestamp' })
  deadlineAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
