import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InstructorsService } from './instructors.service';
import { CreateInstructorDto } from './dto/create-instructor.dto';
import { UpdateInstructorDto } from './dto/update-instructor.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('instructors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('instructors')
export class InstructorsController {
  constructor(private readonly instructorsService: InstructorsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear instructor (solo admin)' })
  create(@Body() dto: CreateInstructorDto) {
    return this.instructorsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar instructores activos' })
  findAll() {
    return this.instructorsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener instructor por ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.instructorsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Actualizar instructor (solo admin)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInstructorDto,
  ) {
    return this.instructorsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Desactivar instructor (solo admin)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.instructorsService.remove(id);
  }
}
