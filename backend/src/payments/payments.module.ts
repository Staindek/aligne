import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { User } from '../users/entities/user.entity';
import { Pack } from '../packs/entities/pack.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, User, Pack]),
    NotificationsModule,
    forwardRef(() => BookingsModule),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
