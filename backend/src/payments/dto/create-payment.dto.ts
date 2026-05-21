import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsString, Matches } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({ example: 'uuid-del-usuario' })
  @IsUUID()
  userId: string;

  @ApiProperty({ example: 'uuid-del-pack' })
  @IsUUID()
  packId: string;

  @ApiProperty({ example: '2026-05' })
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'El mes debe tener formato YYYY-MM' })
  month: string;
}
