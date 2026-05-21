import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Invitation } from './entities/invitation.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { CreateInvitationDto } from './dto/create-invitation.dto';

const DEFAULT_EXPIRY_DAYS = 7;

@Injectable()
export class InvitationsService {
  constructor(
    @InjectRepository(Invitation)
    private readonly invitationsRepository: Repository<Invitation>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(dto: CreateInvitationDto, createdBy: User): Promise<Invitation> {
    const existingUser = await this.usersRepository.findOne({ where: { email: dto.email } });
    if (existingUser) {
      throw new ConflictException('Ya existe una cuenta con ese email');
    }

    // Revocar invitaciones pendientes anteriores al mismo email
    await this.invitationsRepository.update(
      { email: dto.email, usedAt: null as unknown as Date },
      { usedAt: new Date() },
    );

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const invitation = this.invitationsRepository.create({
      token,
      email: dto.email,
      role: dto.role,
      expiresAt,
      createdBy,
    });

    return this.invitationsRepository.save(invitation);
  }

  async findByToken(token: string): Promise<Invitation> {
    const invitation = await this.invitationsRepository.findOne({ where: { token } });
    if (!invitation) throw new NotFoundException('Invitación no encontrada');
    return invitation;
  }

  async validate(token: string): Promise<Invitation> {
    const invitation = await this.findByToken(token);
    if (invitation.usedAt) throw new BadRequestException('Esta invitación ya fue utilizada');
    if (invitation.expiresAt < new Date())
      throw new BadRequestException('Esta invitación expiró');
    return invitation;
  }

  async consume(token: string): Promise<Invitation> {
    const invitation = await this.validate(token);
    invitation.usedAt = new Date();
    return this.invitationsRepository.save(invitation);
  }

  findPending(): Promise<Invitation[]> {
    return this.invitationsRepository
      .createQueryBuilder('i')
      .where('i.usedAt IS NULL')
      .andWhere('i.expiresAt > :now', { now: new Date() })
      .orderBy('i.createdAt', 'DESC')
      .getMany();
  }

  findAll(): Promise<Invitation[]> {
    return this.invitationsRepository.find({ order: { createdAt: 'DESC' } });
  }

  async revoke(id: string): Promise<void> {
    const invitation = await this.invitationsRepository.findOne({ where: { id } });
    if (!invitation) throw new NotFoundException('Invitación no encontrada');
    if (invitation.usedAt)
      throw new BadRequestException('No se puede revocar una invitación ya utilizada');
    invitation.usedAt = new Date();
    await this.invitationsRepository.save(invitation);
  }

  // Helper para que otros módulos generen una invitación sin DTO
  async createForRole(email: string, role: UserRole, createdBy: User): Promise<Invitation> {
    return this.create({ email, role }, createdBy);
  }
}
