import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PilatesClass } from '../../classes/entities/class.entity';
import { Instructor } from '../../instructors/entities/instructor.entity';

@Entity('schedules')
export class Schedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PilatesClass, { eager: true })
  @JoinColumn()
  pilatesClass: PilatesClass;

  @ManyToOne(() => Instructor, { eager: true })
  @JoinColumn()
  instructor: Instructor;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'time' })
  startTime: string;

  @Column({ type: 'time' })
  endTime: string;

  @Column()
  maxCapacity: number;

  @Column({ default: 0 })
  enrolledCount: number;

  @Column({ default: false })
  isCancelled: boolean;

  // Marca cuándo la clase quedó vacía (último alumnx canceló).
  // Si pasa EMPTY_CLASS_AUTO_CANCEL_HOURS y sigue vacía, se auto-cancela.
  @Column({ type: 'timestamp', nullable: true })
  emptyAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
