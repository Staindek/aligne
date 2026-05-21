import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateInstructorDto {
  @ApiProperty({ example: 'Laura' })
  @IsString({ message: 'El nombre debe ser texto' })
  firstName: string;

  @ApiProperty({ example: 'Gómez' })
  @IsString({ message: 'El apellido debe ser texto' })
  lastName: string;

  @ApiProperty({ example: 'laura@pilates.com' })
  @IsEmail({}, { message: 'Debe ser un email válido' })
  email: string;

  @ApiPropertyOptional({ example: '+54911234567' })
  @IsOptional()
  @IsString({ message: 'El teléfono debe ser texto' })
  phone?: string;

  @ApiPropertyOptional({ example: 'Instructora certificada con 5 años de experiencia' })
  @IsOptional()
  @IsString({ message: 'La biografía debe ser texto' })
  bio?: string;

  @ApiPropertyOptional({ example: 'Reformer, Mat' })
  @IsOptional()
  @IsString({ message: 'La especialidad debe ser texto' })
  specialty?: string;
}
