import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PeriodCloseKind, PeriodCloseReviewStatus } from '@prisma/client';
import { ACCOUNTING_CONTROL_ROLES, OFFICE_WRITE_ROLES } from '../auth/role-groups';
import { Roles } from '../auth/roles.decorator';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { TenantContext } from '../common/tenant/tenant-context';
import { GeneratePeriodCloseDto } from './dto/generate-period-close.dto';
import { RejectPeriodCloseDto } from './dto/reject-period-close.dto';
import { UpdatePeriodCloseCheckDto } from './dto/update-period-close-check.dto';
import { PeriodClosesService } from './period-closes.service';

@ApiTags('period-closes')
@Controller('period-closes')
export class PeriodClosesController {
  constructor(private readonly periodClosesService: PeriodClosesService) {}

  @Get()
  findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query('clientCompanyId') clientCompanyId?: string,
    @Query('year') year?: string,
    @Query('kind') kind?: PeriodCloseKind,
    @Query('status') status?: PeriodCloseReviewStatus,
  ) {
    return this.periodClosesService.findAll(tenant, {
      clientCompanyId,
      year: year ? Number(year) : undefined,
      kind,
      status,
    });
  }

  @Post('generate')
  @Roles(...OFFICE_WRITE_ROLES)
  generate(@CurrentTenant() tenant: TenantContext, @Body() dto: GeneratePeriodCloseDto) {
    return this.periodClosesService.generate(tenant, dto);
  }

  @Patch(':id/checklist')
  @Roles(...OFFICE_WRITE_ROLES)
  updateChecklist(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdatePeriodCloseCheckDto,
  ) {
    return this.periodClosesService.updateChecklist(tenant, id, dto);
  }

  @Post(':id/submit')
  @Roles(...OFFICE_WRITE_ROLES)
  submit(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.periodClosesService.submit(tenant, id);
  }

  @Post(':id/approve')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  approve(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.periodClosesService.approve(tenant, id);
  }

  @Post(':id/reject')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  reject(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: RejectPeriodCloseDto,
  ) {
    return this.periodClosesService.reject(tenant, id, dto.reason);
  }
}
