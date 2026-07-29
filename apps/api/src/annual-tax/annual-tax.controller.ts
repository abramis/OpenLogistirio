import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ACCOUNTING_CONTROL_ROLES, OFFICE_WRITE_ROLES } from '../auth/role-groups';
import { Roles } from '../auth/roles.decorator';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { TenantContext } from '../common/tenant/tenant-context';
import { AnnualTaxService } from './annual-tax.service';
import {
  GenerateAnnualTaxReturnDto,
  PayAnnualTaxInstallmentDto,
  SubmitAnnualTaxReturnDto,
  UpdateAnnualTaxReturnDto,
} from './dto/annual-tax.dto';

@ApiTags('annual-tax')
@Controller('annual-tax')
export class AnnualTaxController {
  constructor(private readonly annualTaxService: AnnualTaxService) {}

  @Get()
  findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query('clientCompanyId') clientCompanyId?: string,
    @Query('fiscalYear') fiscalYear?: string,
  ) {
    return this.annualTaxService.findAll(
      tenant,
      clientCompanyId,
      fiscalYear ? Number(fiscalYear) : undefined,
    );
  }

  @Post('generate')
  @Roles(...OFFICE_WRITE_ROLES)
  generate(@CurrentTenant() tenant: TenantContext, @Body() dto: GenerateAnnualTaxReturnDto) {
    return this.annualTaxService.generate(tenant, dto);
  }

  @Patch(':id')
  @Roles(...OFFICE_WRITE_ROLES)
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateAnnualTaxReturnDto,
  ) {
    return this.annualTaxService.update(tenant, id, dto);
  }

  @Post(':id/ready')
  @Roles(...OFFICE_WRITE_ROLES)
  markReady(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.annualTaxService.markReady(tenant, id);
  }

  @Post(':id/approve')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  approve(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.annualTaxService.approve(tenant, id);
  }

  @Post(':id/reopen')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  reopen(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.annualTaxService.reopen(tenant, id);
  }

  @Post(':id/submit')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  submit(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: SubmitAnnualTaxReturnDto,
  ) {
    return this.annualTaxService.submit(tenant, id, dto);
  }

  @Post('installments/:installmentId/pay')
  @Roles(...OFFICE_WRITE_ROLES)
  payInstallment(
    @CurrentTenant() tenant: TenantContext,
    @Param('installmentId') installmentId: string,
    @Body() dto: PayAnnualTaxInstallmentDto,
  ) {
    return this.annualTaxService.payInstallment(tenant, installmentId, dto);
  }
}
