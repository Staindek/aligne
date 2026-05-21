import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { AttendanceStatus } from '../entities/booking.entity';

export class MarkAttendanceDto {
  @ApiProperty({ enum: AttendanceStatus })
  @IsEnum(AttendanceStatus, { message: 'Estado de asistencia inválido' })
  status: AttendanceStatus;
}
