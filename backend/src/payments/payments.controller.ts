import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { ChangePackDto, AdminChangePackDto } from './dto/change-pack.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // Webhook de Mercado Pago — sin auth
  @Post('webhook')
  @ApiOperation({ summary: 'Webhook Mercado Pago (no requiere auth)' })
  webhook(@Req() req: Request) {
    const body = req.body as Record<string, unknown>;
    return this.paymentsService.handleWebhook(body);
  }

  // Pagos del alumnx
  @Get('my')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Mis pagos' })
  myPayments(@CurrentUser() user: User) {
    return this.paymentsService.findMyPayments(user.id);
  }

  // Resumen del mes (pack vigente, total pagado, lista de pagos)
  @Get('current')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Resumen del mes en curso del alumnx' })
  currentMonth(@CurrentUser() user: User) {
    return this.paymentsService.getMonthSummary(user.id);
  }

  // Alumnx inicia un pago para un pack (o upgrade)
  @Post('initiate')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Iniciar pago / upgrade para un pack' })
  initiate(@CurrentUser() user: User, @Body() dto: InitiatePaymentDto) {
    return this.paymentsService.initiatePackPayment(user.id, dto.packId, dto.month);
  }

  @Post('change-pack')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Cambiar a un pack menor el mes ya pagado (la diferencia va al crédito)',
  })
  changePack(@CurrentUser() user: User, @Body() dto: ChangePackDto) {
    return this.paymentsService.changePackForPaidMonth(user.id, dto.newPackId, dto.month);
  }

  @Post('admin/change-pack')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Admin cambia pack del mes a otra alumnx (downgrade con crédito)',
  })
  adminChangePack(@Body() dto: AdminChangePackDto) {
    return this.paymentsService.changePackForPaidMonth(dto.userId, dto.newPackId, dto.month);
  }

  @Post(':id/checkout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Iniciar checkout Mercado Pago para un pago existente' })
  checkout(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.paymentsService.createCheckout(id, user.id);
  }

  @Post(':id/verify')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Verificar estado del pago con MP' })
  verify(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.paymentsService.verifyByPreference(id, user.id);
  }

  // Admin
  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Todos los pagos (admin)' })
  findAll() {
    return this.paymentsService.findAll();
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear registro de pago (admin)' })
  create(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.adminCreate(dto);
  }

  @Patch(':id/paid')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Marcar pago como pagado (admin)' })
  markPaid(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.adminMarkPaid(id);
  }
}
