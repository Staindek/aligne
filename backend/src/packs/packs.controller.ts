import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PacksService } from './packs.service';
import { CreatePackDto } from './dto/create-pack.dto';
import { UpdatePackDto } from './dto/update-pack.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('packs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('packs')
export class PacksController {
  constructor(private readonly packsService: PacksService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear pack (solo admin)' })
  create(@Body() dto: CreatePackDto) {
    return this.packsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar packs' })
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.packsService.findAll(includeInactive === 'true');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener pack por ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.packsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Actualizar pack (solo admin)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePackDto) {
    return this.packsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Desactivar pack (solo admin)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.packsService.remove(id);
  }
}
