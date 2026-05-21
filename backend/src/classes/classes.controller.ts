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
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('classes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear tipo de clase (solo admin)' })
  create(@Body() dto: CreateClassDto) {
    return this.classesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar tipos de clase' })
  findAll() {
    return this.classesService.findAll();
  }

  @Post('reorder')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Reordenar tipos de clase (solo admin)' })
  reorder(@Body() body: { ids: string[] }) {
    return this.classesService.reorder(body.ids);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener tipo de clase por ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.classesService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Actualizar tipo de clase (solo admin)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClassDto,
  ) {
    return this.classesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Desactivar tipo de clase (solo admin)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.classesService.remove(id);
  }
}
