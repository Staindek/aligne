import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { Schedule } from '../schedules/entities/schedule.entity';
import { Payment } from '../payments/entities/payment.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, Schedule, Payment])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
