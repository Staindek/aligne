import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Schedule } from './entities/schedule.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { User } from '../users/entities/user.entity';
import { SchedulesService } from './schedules.service';
import { SchedulesController } from './schedules.controller';
import { ClassesModule } from '../classes/classes.module';
import { InstructorsModule } from '../instructors/instructors.module';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Schedule, Booking, User]),
    ClassesModule,
    InstructorsModule,
    forwardRef(() => PaymentsModule),
    NotificationsModule,
    forwardRef(() => BookingsModule),
  ],
  controllers: [SchedulesController],
  providers: [SchedulesService],
  exports: [SchedulesService],
})
export class SchedulesModule {}
