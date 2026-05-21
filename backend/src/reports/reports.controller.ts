import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Resumen del mes para admin' })
  @ApiQuery({ name: 'month', required: false, description: 'YYYY-MM (default: mes actual)' })
  summary(@Query('month') month?: string) {
    const m = month ?? new Date().toISOString().substring(0, 7);
    return this.reportsService.summary(m);
  }
}
