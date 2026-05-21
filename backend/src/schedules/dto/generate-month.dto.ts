import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

export class GenerateMonthDto {
  @ApiPropertyOptional({
    example: '2026-06',
    description: 'Mes objetivo YYYY-MM. Por defecto, el próximo mes.',
  })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month debe tener formato YYYY-MM',
  })
  month?: string;
}
