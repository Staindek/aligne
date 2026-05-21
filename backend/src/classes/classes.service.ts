import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PilatesClass } from './entities/class.entity';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';

@Injectable()
export class ClassesService {
  constructor(
    @InjectRepository(PilatesClass)
    private readonly classesRepository: Repository<PilatesClass>,
  ) {}

  async create(dto: CreateClassDto): Promise<PilatesClass> {
    const existing = await this.classesRepository.findOne({
      where: { name: dto.name },
    });
    const nextOrder = await this.nextDisplayOrder();
    if (existing) {
      if (existing.isActive) {
        throw new ConflictException('Ya existe una clase con ese nombre');
      }
      Object.assign(existing, dto);
      existing.isActive = true;
      existing.displayOrder = nextOrder;
      return this.classesRepository.save(existing);
    }

    const pilatesClass = this.classesRepository.create({ ...dto, displayOrder: nextOrder });
    return this.classesRepository.save(pilatesClass);
  }

  private async nextDisplayOrder(): Promise<number> {
    const last = await this.classesRepository.findOne({
      where: { isActive: true },
      order: { displayOrder: 'DESC' },
    });
    return (last?.displayOrder ?? 0) + 1;
  }

  findAll(): Promise<PilatesClass[]> {
    return this.classesRepository.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async reorder(ids: string[]): Promise<PilatesClass[]> {
    await Promise.all(
      ids.map((id, index) =>
        this.classesRepository.update({ id }, { displayOrder: index + 1 }),
      ),
    );
    return this.findAll();
  }

  async findOne(id: string): Promise<PilatesClass> {
    const pilatesClass = await this.classesRepository.findOne({ where: { id } });
    if (!pilatesClass) throw new NotFoundException(`Clase ${id} no encontrada`);
    return pilatesClass;
  }

  async update(id: string, dto: UpdateClassDto): Promise<PilatesClass> {
    const pilatesClass = await this.findOne(id);
    Object.assign(pilatesClass, dto);
    return this.classesRepository.save(pilatesClass);
  }

  async remove(id: string): Promise<void> {
    const pilatesClass = await this.findOne(id);
    pilatesClass.isActive = false;
    await this.classesRepository.save(pilatesClass);
  }
}
