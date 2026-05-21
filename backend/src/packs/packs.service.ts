import {
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pack } from './entities/pack.entity';
import { CreatePackDto } from './dto/create-pack.dto';
import { UpdatePackDto } from './dto/update-pack.dto';

const DEFAULT_PACKS: { name: string; classCount: number | null; price: number }[] = [
  { name: 'Pack 4 clases', classCount: 4, price: 10000 },
  { name: 'Pack 8 clases', classCount: 8, price: 18000 },
  { name: 'Pack 12 clases', classCount: 12, price: 25000 },
  { name: 'Pase libre', classCount: null, price: 32000 },
];

@Injectable()
export class PacksService implements OnModuleInit {
  constructor(
    @InjectRepository(Pack)
    private readonly packsRepository: Repository<Pack>,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.packsRepository.count();
    if (count > 0) return;
    await this.packsRepository.save(
      DEFAULT_PACKS.map((p) => this.packsRepository.create(p)),
    );
  }

  async create(dto: CreatePackDto): Promise<Pack> {
    const existing = await this.packsRepository.findOne({
      where: { name: dto.name },
    });
    if (existing) {
      if (existing.isActive) {
        throw new ConflictException('Ya existe un pack con ese nombre');
      }
      Object.assign(existing, dto, { classCount: dto.classCount ?? null });
      existing.isActive = true;
      return this.packsRepository.save(existing);
    }
    const pack = this.packsRepository.create({
      ...dto,
      classCount: dto.classCount ?? null,
    });
    return this.packsRepository.save(pack);
  }

  findAll(includeInactive = false): Promise<Pack[]> {
    return this.packsRepository.find({
      where: includeInactive ? {} : { isActive: true },
      order: { classCount: { direction: 'ASC', nulls: 'LAST' } },
    });
  }

  async findOne(id: string): Promise<Pack> {
    const pack = await this.packsRepository.findOne({ where: { id } });
    if (!pack) throw new NotFoundException(`Pack ${id} no encontrado`);
    return pack;
  }

  async update(id: string, dto: UpdatePackDto): Promise<Pack> {
    const pack = await this.findOne(id);
    Object.assign(pack, dto);
    return this.packsRepository.save(pack);
  }

  async remove(id: string): Promise<void> {
    const pack = await this.findOne(id);
    pack.isActive = false;
    await this.packsRepository.save(pack);
  }
}
