import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Instructor } from './entities/instructor.entity';
import { CreateInstructorDto } from './dto/create-instructor.dto';
import { UpdateInstructorDto } from './dto/update-instructor.dto';

@Injectable()
export class InstructorsService {
  constructor(
    @InjectRepository(Instructor)
    private readonly instructorsRepository: Repository<Instructor>,
  ) {}

  async create(dto: CreateInstructorDto): Promise<Instructor> {
    const existing = await this.instructorsRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      if (existing.isActive) {
        throw new ConflictException('El email ya está registrado');
      }
      Object.assign(existing, dto);
      existing.isActive = true;
      return this.instructorsRepository.save(existing);
    }

    const instructor = this.instructorsRepository.create(dto);
    return this.instructorsRepository.save(instructor);
  }

  findAll(): Promise<Instructor[]> {
    return this.instructorsRepository.find({ where: { isActive: true } });
  }

  async findOne(id: string): Promise<Instructor> {
    const instructor = await this.instructorsRepository.findOne({
      where: { id },
    });
    if (!instructor)
      throw new NotFoundException(`Instructor ${id} no encontrado`);
    return instructor;
  }

  async update(id: string, dto: UpdateInstructorDto): Promise<Instructor> {
    const instructor = await this.findOne(id);
    Object.assign(instructor, dto);
    return this.instructorsRepository.save(instructor);
  }

  async remove(id: string): Promise<void> {
    const instructor = await this.findOne(id);
    instructor.isActive = false;
    await this.instructorsRepository.save(instructor);
  }
}
