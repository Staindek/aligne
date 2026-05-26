import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { UserRole } from '../entities/user.entity';
import { ClassLevel } from '../../common/enums/level.enum';

export class CreateUserDto {
  @ApiProperty({ example: 'ana@pilates.com' })
  @IsEmail({}, { message: 'Debe ser un email válido' })
  email: string;

  @ApiProperty({ example: 'micontraseña', minLength: 6 })
  @IsString({ message: 'La contraseña debe ser texto' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;

  @ApiProperty({ example: 'Ana' })
  @IsString({ message: 'El nombre debe ser texto' })
  firstName: string;

  @ApiProperty({ example: 'García' })
  @IsString({ message: 'El apellido debe ser texto' })
  lastName: string;

  @ApiPropertyOptional({ example: '+54911234567' })
  @IsOptional()
  @IsString({ message: 'El teléfono debe ser texto' })
  phone?: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.STUDENT })
  @IsOptional()
  @IsEnum(UserRole, { message: 'El rol debe ser admin, instructor o student' })
  role?: UserRole;

  @ApiPropertyOptional({
    description: 'Token de invitación (opcional, fija el rol)',
  })
  @IsOptional()
  @IsString()
  invitationToken?: string;

  @ApiPropertyOptional({ enum: ClassLevel })
  @IsOptional()
  @IsEnum(ClassLevel, { message: 'Nivel inválido' })
  level?: ClassLevel;
}
