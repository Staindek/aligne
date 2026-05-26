import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class BulkCreateSchedulesDto {
  @ApiProperty({ example: 'uuid-de-la-modalidad' })
  @IsUUID('4', { message: 'El ID de la modalidad no es válido' })
  pilatesClassId: string;

  @ApiProperty({ example: 'uuid-de-la-instructora' })
  @IsUUID('4', { message: 'El ID de la instructora no es válido' })
  instructorId: string;

  @ApiProperty({
    example: [1, 3, 5],
    description: 'Días de la semana (0=Domingo, 1=Lunes, ..., 6=Sábado)',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Elegí al menos un día' })
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek: number[];

  @ApiProperty({ example: '09:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'La hora debe tener formato HH:MM',
  })
  startTime: string;

  @ApiProperty({ example: '2026-05-19' })
  @IsDateString(
    {},
    { message: 'La fecha de inicio debe tener formato AAAA-MM-DD' },
  )
  startDate: string;

  @ApiProperty({ example: '2026-06-30' })
  @IsDateString(
    {},
    { message: 'La fecha de fin debe tener formato AAAA-MM-DD' },
  )
  endDate: string;
}
