import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './entities/booking.entity';
import { RecurringBooking } from './entities/recurring-booking.entity';
import { MaterializationProposal } from './entities/materialization-proposal.entity';
import { Schedule } from '../schedules/entities/schedule.entity';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { RecurringBookingsService } from './recurring-bookings.service';
import { RecurringBookingsController } from './recurring-bookings.controller';
import { MaterializationProposalsService } from './materialization-proposals.service';
import { MaterializationProposalsController } from './materialization-proposals.controller';
import { SchedulesModule } from '../schedules/schedules.module';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Booking,
      RecurringBooking,
      MaterializationProposal,
      Schedule,
    ]),
    forwardRef(() => SchedulesModule),
    forwardRef(() => PaymentsModule),
    NotificationsModule,
  ],
  controllers: [
    BookingsController,
    RecurringBookingsController,
    MaterializationProposalsController,
  ],
  providers: [
    BookingsService,
    RecurringBookingsService,
    MaterializationProposalsService,
  ],
  exports: [RecurringBookingsService, MaterializationProposalsService],
})
export class BookingsModule {}
