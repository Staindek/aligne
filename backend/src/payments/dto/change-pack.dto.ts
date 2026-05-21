import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, Matches } from 'class-validator';

export class ChangePackDto {
  @ApiProperty({ example: 'uuid-del-pack-nuevo-mas-chico' })
  @IsUUID()
  newPackId: string;

  @ApiPropertyOptional({
    example: '2026-06',
    description: 'Mes objetivo YYYY-MM. Por defecto, mes actual.',
  })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month debe tener formato YYYY-MM',
  })
  month?: string;
}

export class AdminChangePackDto extends ChangePackDto {
  @ApiProperty({ example: 'uuid-del-usuario' })
  @IsUUID()
  userId: string;
}
