import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { InvitationsService } from '../invitations/invitations.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly invitationsService: InvitationsService,
  ) {}

  async register(createUserDto: CreateUserDto) {
    const { invitationToken, ...userData } = createUserDto;

    if (invitationToken) {
      const invitation = await this.invitationsService.validate(invitationToken);
      if (invitation.email.toLowerCase() !== userData.email.toLowerCase()) {
        throw new BadRequestException('El email no coincide con la invitación');
      }
      userData.role = invitation.role;
      const user = await this.usersService.create(userData);
      await this.invitationsService.consume(invitationToken);
      return this.buildResponse(user.id, user.email, user.role);
    }

    // Registro abierto siempre crea alumnxs, sin importar lo que mande el cliente
    userData.role = undefined;
    const user = await this.usersService.create(userData);
    return this.buildResponse(user.id, user.email, user.role);
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const valid = await bcrypt.compare(loginDto.password, user.password);
    if (!valid) throw new UnauthorizedException('Credenciales inválidas');

    if (!user.isActive) throw new UnauthorizedException('Usuario inactivo');

    return this.buildResponse(user.id, user.email, user.role);
  }

  async forgotPassword(email: string): Promise<{ message: string; resetToken?: string }> {
    const user = await this.usersService.findByEmail(email);

    // Siempre responder igual para no revelar si el email existe
    if (!user) {
      return { message: 'Si el email está registrado, recibirás instrucciones para restablecer tu contraseña.' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    user.resetToken = token;
    user.resetTokenExpiry = expiry;
    await this.usersRepository.save(user);

    // En producción: enviar email. En desarrollo: devolver token en respuesta.
    const isDev = process.env.NODE_ENV !== 'production';
    console.log(`[Aligné] Reset token para ${email}: ${token}`);

    return {
      message: 'Si el email está registrado, recibirás instrucciones para restablecer tu contraseña.',
      ...(isDev && { resetToken: token }),
    };
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await this.usersRepository.findOne({
      where: { resetToken: token },
    });

    if (!user) throw new BadRequestException('Token inválido o expirado');
    if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date())
      throw new BadRequestException('El token de recuperación expiró');

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetToken = null as unknown as string;
    user.resetTokenExpiry = null as unknown as Date;
    await this.usersRepository.save(user);
  }

  private buildResponse(id: string, email: string, role: string) {
    const payload: JwtPayload = { sub: id, email, role };
    return {
      accessToken: this.jwtService.sign(payload),
      user: { id, email, role },
    };
  }
}
