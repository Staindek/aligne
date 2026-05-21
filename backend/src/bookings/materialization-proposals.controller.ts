import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { MaterializationProposalsService } from './materialization-proposals.service';
import { ResolveProposalDto } from './dto/resolve-proposal.dto';

@ApiTags('materialization-proposals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bookings/recurring/proposals')
export class MaterializationProposalsController {
  constructor(private readonly service: MaterializationProposalsService) {}

  @Get('pending')
  @ApiOperation({ summary: 'Propuestas pendientes (la alumnx debe elegir)' })
  pending(@CurrentUser() user: User) {
    return this.service.findPendingForUser(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una propuesta (incluye schedules)' })
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.findByIdForUserDetailed(id, user.id);
  }

  @Post(':id/resolve')
  @ApiOperation({ summary: 'Confirmar selección y materializar reservas' })
  resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveProposalDto,
    @CurrentUser() user: User,
  ) {
    return this.service.resolveByUser(id, user.id, dto.selectedScheduleIds);
  }
}
