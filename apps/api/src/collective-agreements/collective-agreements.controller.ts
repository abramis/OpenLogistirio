import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ACCOUNTING_CONTROL_ROLES, OFFICE_WRITE_ROLES } from '../auth/role-groups';
import { Roles } from '../auth/roles.decorator';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { TenantContext } from '../common/tenant/tenant-context';
import { CollectiveAgreementsService } from './collective-agreements.service';
import {
  ApplyCollectiveAgreementDto,
  CreateCollectiveAgreementDto,
  CreateCollectiveAgreementVersionDto,
  EvaluateCollectiveAgreementDto,
} from './dto/collective-agreement.dto';

@ApiTags('collective-agreements')
@Controller('collective-agreements')
export class CollectiveAgreementsController {
  constructor(private readonly service: CollectiveAgreementsService) {}

  @Get()
  findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query('clientCompanyId') clientCompanyId?: string,
  ) {
    return this.service.findAll(tenant, clientCompanyId);
  }
  @Post()
  @Roles(...OFFICE_WRITE_ROLES)
  create(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateCollectiveAgreementDto) {
    return this.service.create(tenant, dto);
  }
  @Post(':id/versions')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  addVersion(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: CreateCollectiveAgreementVersionDto,
  ) {
    return this.service.addVersion(tenant, id, dto);
  }
  @Post('evaluate')
  evaluate(@CurrentTenant() tenant: TenantContext, @Body() dto: EvaluateCollectiveAgreementDto) {
    return this.service.evaluate(tenant, dto);
  }
  @Post('contracts/:contractId/apply')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  apply(
    @CurrentTenant() tenant: TenantContext,
    @Param('contractId') contractId: string,
    @Body() dto: ApplyCollectiveAgreementDto,
  ) {
    return this.service.applyToContract(tenant, contractId, dto);
  }
}
