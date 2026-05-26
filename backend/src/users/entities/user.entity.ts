import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { ClassLevel } from '../../common/enums/level.enum';

export enum UserRole {
  ADMIN = 'admin',
  INSTRUCTOR = 'instructor',
  STUDENT = 'student',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude()
  password: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.STUDENT })
  role: UserRole;

  @Column({ type: 'enum', enum: ClassLevel, default: ClassLevel.PRINCIPIANTE })
  level: ClassLevel;

  @Column({ default: true })
  isActive: boolean;

  // Crédito acumulado en pesos (de downgrades o ajustes). Se aplica al próximo pago.
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  credit: number;

  // Crédito acumulado en CLASES (de downgrades cerca del cierre de mes).
  // Suma al cap del mes objetivo `classCreditMonth`.
  @Column({ type: 'int', default: 0 })
  classCredit: number;

  @Column({ type: 'varchar', length: 7, nullable: true })
  classCreditMonth: string | null; // YYYY-MM

  @Column({ nullable: true })
  @Exclude()
  resetToken: string;

  @Column({ nullable: true })
  @Exclude()
  resetTokenExpiry: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
