import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RecurringBookingsService } from './recurring-bookings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

class CreateRecurringBookingDto {
  @ApiProperty()
  @IsUUID()
  scheduleId: string;
}

@ApiTags('bookings-recurring')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bookings/recurring')
export class RecurringBookingsController {
  constructor(private readonly recurringService: RecurringBookingsService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear reserva recurrente (todos los X a la misma hora)',
  })
  create(@Body() dto: CreateRecurringBookingDto, @CurrentUser() user: User) {
    return this.recurringService.createFromSchedule(dto.scheduleId, user);
  }

  @Get('my')
  @ApiOperation({ summary: 'Mis reservas recurrentes activas' })
  myActive(@CurrentUser() user: User) {
    return this.recurringService.findMyActive(user.id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Cancelar reserva recurrente y todas las futuras de esta serie',
  })
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.recurringService.cancel(id, user);
  }
}
