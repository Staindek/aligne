import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User, UserRole } from '../../users/entities/user.entity';

@Entity('invitations')
@Index(['token'], { unique: true })
@Index(['email'])
export class Invitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  token: string;

  @Column()
  email: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @Column()
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  usedAt: Date | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  createdBy: User | null;

  @CreateDateColumn()
  createdAt: Date;
}
