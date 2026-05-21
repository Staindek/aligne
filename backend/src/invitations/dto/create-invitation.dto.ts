import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum } from 'class-validator';
import { UserRole } from '../../users/entities/user.entity';

export class CreateInvitationDto {
  @ApiProperty({ example: 'camila@aligne.com' })
  @IsEmail({}, { message: 'Debe ser un email válido' })
  email: string;

  @ApiProperty({ enum: UserRole, example: UserRole.INSTRUCTOR })
  @IsEnum(UserRole, { message: 'El rol debe ser admin, instructor o student' })
  role: UserRole;
}
