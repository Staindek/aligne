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
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { BulkCreateSchedulesDto } from './dto/bulk-create-schedules.dto';
import { GenerateMonthDto } from './dto/generate-month.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';

@ApiTags('schedules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear sesión programada (solo admin)' })
  create(@Body() dto: CreateScheduleDto) {
    return this.schedulesService.create(dto);
  }

  @Post('bulk')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Agendar varias clases en un rango con días de la semana (solo admin)',
  })
  bulkCreate(@Body() dto: BulkCreateSchedulesDto) {
    return this.schedulesService.bulkCreate(dto);
  }

  @Post('generate-month')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Generar mes desde el mes anterior. Por defecto, próximo mes (solo admin)',
  })
  generateMonth(@Body() dto: GenerateMonthDto) {
    const month = dto.month ?? this.nextMonth();
    return this.schedulesService.generateFromPreviousMonth(month);
  }

  private nextMonth(): string {
    const d = new Date();
    const y = d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear();
    const m = d.getMonth() === 11 ? 1 : d.getMonth() + 2;
    return `${y}-${String(m).padStart(2, '0')}`;
  }

  @Get()
  @ApiOperation({ summary: 'Listar sesiones' })
  @ApiQuery({ name: 'date', required: false, example: '2026-05-20' })
  findAll(@Query('date') date?: string) {
    if (date) return this.schedulesService.findByDate(date);
    return this.schedulesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener sesión por ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.schedulesService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  @ApiOperation({
    summary: 'Actualizar sesión (admin todas, instructor solo las suyas)',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScheduleDto,
    @CurrentUser() user: User,
  ) {
    return this.schedulesService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  @ApiOperation({
    summary: 'Cancelar sesión (admin todas, instructor solo las suyas)',
  })
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.schedulesService.cancel(id, user);
  }
}
