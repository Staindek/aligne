import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ClassLevel } from '../../common/enums/level.enum';

@Entity('classes')
export class PilatesClass {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column()
  durationMinutes: number;

  @Column()
  maxCapacity: number;

  @Column({ type: 'enum', enum: ClassLevel, default: ClassLevel.ABIERTO })
  level: ClassLevel;

  @Column({ default: 0 })
  displayOrder: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
