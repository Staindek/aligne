import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';

export class CreateScheduleDto {
  @ApiProperty({ example: 'uuid-de-la-clase' })
  @IsUUID('4', { message: 'El ID de la clase no es válido' })
  pilatesClassId: string;

  @ApiProperty({ example: 'uuid-del-instructor' })
  @IsUUID('4', { message: 'El ID de la instructora no es válido' })
  instructorId: string;

  @ApiProperty({ example: '2026-05-20' })
  @IsDateString({}, { message: 'La fecha debe tener formato AAAA-MM-DD' })
  date: string;

  @ApiProperty({ example: '09:00' })
  @IsString({ message: 'El horario de inicio debe ser texto' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'El horario de inicio debe tener formato HH:MM' })
  startTime: string;

  @ApiProperty({ example: '10:00' })
  @IsString({ message: 'El horario de fin debe ser texto' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'El horario de fin debe tener formato HH:MM' })
  endTime: string;

  @ApiPropertyOptional({ example: 6, description: 'Sobreescribe la capacidad máxima de la clase' })
  @IsOptional()
  @IsInt({ message: 'La capacidad debe ser un número entero' })
  @Min(1, { message: 'La capacidad mínima es 1' })
  maxCapacity?: number;
}
