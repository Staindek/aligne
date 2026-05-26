import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ClassLevel } from '../../common/enums/level.enum';

export class CreateClassDto {
  @ApiProperty({ example: 'Reformer Nivel 1' })
  @IsString({ message: 'El nombre debe ser texto' })
  name: string;

  @ApiPropertyOptional({
    example: 'Clase de pilates en máquina Reformer para nivel inicial',
  })
  @IsOptional()
  @IsString({ message: 'La descripción debe ser texto' })
  description?: string;

  @ApiProperty({ example: 60, description: 'Duración en minutos' })
  @IsInt({ message: 'La duración debe ser un número entero de minutos' })
  @Min(15, { message: 'La duración mínima es 15 minutos' })
  durationMinutes: number;

  @ApiProperty({ example: 8, description: 'Capacidad máxima de alumnas' })
  @IsInt({ message: 'La capacidad debe ser un número entero' })
  @Min(1, { message: 'La capacidad mínima es 1' })
  maxCapacity: number;

  @ApiPropertyOptional({ enum: ClassLevel, default: ClassLevel.ABIERTO })
  @IsOptional()
  @IsEnum(ClassLevel, { message: 'Nivel inválido' })
  level?: ClassLevel;
}
