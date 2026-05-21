import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({ example: 'uuid-de-la-sesion' })
  @IsUUID('4', { message: 'El ID de la sesión no es válido' })
  scheduleId: string;
}
