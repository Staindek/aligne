import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('my')
  @ApiOperation({
    summary: 'Listar mis notificaciones (más recientes primero)',
  })
  myNotifications(@CurrentUser() user: User) {
    return this.notificationsService.findMyNotifications(user.id);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Contar mis notificaciones sin leer' })
  async unreadCount(@CurrentUser() user: User) {
    const count = await this.notificationsService.countUnread(user.id);
    return { count };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marcar una notificación como leída' })
  async markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    await this.notificationsService.markRead(id, user.id);
    return { ok: true };
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Marcar todas mis notificaciones como leídas' })
  async markAllRead(@CurrentUser() user: User) {
    await this.notificationsService.markAllRead(user.id);
    return { ok: true };
  }
}
