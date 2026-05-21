import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pack } from './entities/pack.entity';
import { PacksService } from './packs.service';
import { PacksController } from './packs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Pack])],
  controllers: [PacksController],
  providers: [PacksService],
  exports: [PacksService, TypeOrmModule],
})
export class PacksModule {}
