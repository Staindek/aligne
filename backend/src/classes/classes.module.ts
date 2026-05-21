import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PilatesClass } from './entities/class.entity';
import { ClassesService } from './classes.service';
import { ClassesController } from './classes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PilatesClass])],
  controllers: [ClassesController],
  providers: [ClassesService],
  exports: [ClassesService],
})
export class ClassesModule {}
