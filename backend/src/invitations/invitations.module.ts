import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invitation } from './entities/invitation.entity';
import { User } from '../users/entities/user.entity';
import { InvitationsService } from './invitations.service';
import { InvitationsController } from './invitations.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Invitation, User])],
  controllers: [InvitationsController],
  providers: [InvitationsService],
  exports: [InvitationsService],
})
export class InvitationsModule {}
