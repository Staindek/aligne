import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
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
import { BookingsService } from './bookings.service';
import { PaymentsService } from '../payments/payments.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { BySchedulesDto } from './dto/by-schedules.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';

@ApiTags('bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Reservar una sesión' })
  create(@Body() dto: CreateBookingDto, @CurrentUser() user: User) {
    return this.bookingsService.create(dto, user);
  }

  @Get('my')
  @ApiOperation({ summary: 'Mis reservas con posición en lista de espera' })
  myBookings(@CurrentUser() user: User) {
    return this.bookingsService.findMyBookingsWithWaitlistPosition(user.id);
  }

  @Get('my/class-count')
  @ApiOperation({
    summary: 'Cantidad de clases usadas este mes y límite del pack',
  })
  @ApiQuery({
    name: 'month',
    required: false,
    description: 'YYYY-MM, default: mes actual',
  })
  async myClassCount(
    @CurrentUser() user: User,
    @Query('month') month?: string,
  ) {
    const [count, limit] = await Promise.all([
      this.bookingsService.getMonthlyClassCountForUser(user.id, month),
      this.paymentsService.getMonthClassLimit(user.id, month),
    ]);
    return { count, limit };
  }

  @Get('schedule/:scheduleId')
  @ApiOperation({ summary: 'Reservas de una sesión' })
  bySchedule(@Param('scheduleId', ParseUUIDPipe) scheduleId: string) {
    return this.bookingsService.findBySchedule(scheduleId);
  }

  @Post('by-schedules')
  @ApiOperation({
    summary:
      'Reservas de varias sesiones en batch (devuelve map por scheduleId)',
  })
  bySchedules(@Body() dto: BySchedulesDto) {
    return this.bookingsService.findBySchedules(dto.ids);
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Confirmar lugar liberado de lista de espera' })
  confirm(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.bookingsService.confirmWaitlistPromotion(id, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancelar reserva' })
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.bookingsService.cancel(id, user);
  }

  @Patch(':id/attendance')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  @ApiOperation({
    summary: 'Marcar asistencia (admin todas, instructora solo las suyas)',
  })
  markAttendance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkAttendanceDto,
    @CurrentUser() user: User,
  ) {
    return this.bookingsService.markAttendance(id, dto.status, user);
  }

  // Admin/Instructor: clases usadas por una alumna este mes
  @Get('user/:userId/class-count')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  @ApiOperation({
    summary: 'Clases usadas por alumna y límite (admin/instructora)',
  })
  @ApiQuery({ name: 'month', required: false })
  async userClassCount(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('month') month?: string,
  ) {
    const [count, limit] = await Promise.all([
      this.bookingsService.getMonthlyClassCountForUser(userId, month),
      this.paymentsService.getMonthClassLimit(userId, month),
    ]);
    return { count, limit };
  }

  @Get('user/:userId/no-show-count')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  @ApiOperation({
    summary: 'Faltas (ausente) de una alumna en el mes (admin/instructora)',
  })
  @ApiQuery({ name: 'month', required: false })
  userNoShowCount(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('month') month?: string,
  ) {
    return this.bookingsService
      .countNoShowsForUser(userId, month)
      .then((count) => ({ count }));
  }
}
