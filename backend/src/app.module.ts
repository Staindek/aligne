import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import databaseConfig from './config/database.config';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { InstructorsModule } from './instructors/instructors.module';
import { ClassesModule } from './classes/classes.module';
import { SchedulesModule } from './schedules/schedules.module';
import { BookingsModule } from './bookings/bookings.module';
import { PaymentsModule } from './payments/payments.module';
import { PacksModule } from './packs/packs.module';
import { NotificationsModule } from './notifications/notifications.module';
import { InvitationsModule } from './invitations/invitations.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions =>
        config.get<TypeOrmModuleOptions>('database')!,
    }),
    ScheduleModule.forRoot(),
    UsersModule,
    AuthModule,
    InstructorsModule,
    ClassesModule,
    SchedulesModule,
    BookingsModule,
    PaymentsModule,
    PacksModule,
    NotificationsModule,
    InvitationsModule,
    ReportsModule,
  ],
})
export class AppModule {}
