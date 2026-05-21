import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePackDto {
  @ApiProperty({ example: 'Pack 4 clases' })
  @IsString({ message: 'El nombre debe ser texto' })
  name: string;

  @ApiPropertyOptional({
    example: 4,
    description: 'Cantidad de clases mensuales. Null = ilimitado (Pase libre).',
    nullable: true,
  })
  @IsOptional()
  @IsInt({ message: 'La cantidad de clases debe ser un entero' })
  @Min(1, { message: 'La cantidad mínima es 1' })
  classCount?: number | null;

  @ApiProperty({ example: 8000, description: 'Precio en ARS' })
  @IsNumber({}, { message: 'El precio debe ser numérico' })
  @Min(0, { message: 'El precio no puede ser negativo' })
  price: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
