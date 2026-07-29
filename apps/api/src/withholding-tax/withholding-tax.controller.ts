import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ACCOUNTING_CONTROL_ROLES, OFFICE_WRITE_ROLES } from '../auth/role-groups';
import { Roles } from '../auth/roles.decorator';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { TenantContext } from '../common/tenant/tenant-context';
import {
  GenerateWithholdingTaxReturnDto,
  PayWithholdingTaxReturnDto,
  SubmitWithholdingTaxReturnDto,
  UpdateWithholdingTaxReturnDto,
  UpsertWithholdingTaxLineDto,
} from './dto/withholding-tax.dto';
import { WithholdingTaxService } from './withholding-tax.service';

@ApiTags('withholding-tax')
@Controller('withholding-tax')
export class WithholdingTaxController {
  constructor(private readonly service: WithholdingTaxService) {}

  @Get()
  findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query('clientCompanyId') clientCompanyId?: string,
    @Query('periodYear') periodYear?: string,
    @Query('periodMonth') periodMonth?: string,
  ) {
    return this.service.findAll(
      tenant,
      clientCompanyId,
      periodYear ? Number(periodYear) : undefined,
      periodMonth ? Number(periodMonth) : undefined,
    );
  }

  @Get('metadata')
  metadata() {
    return this.service.metadata();
  }

  @Post('generate')
  @Roles(...OFFICE_WRITE_ROLES)
  generate(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: GenerateWithholdingTaxReturnDto,
  ) {
    return this.service.generate(tenant, dto);
  }

  @Patch(':id')
  @Roles(...OFFICE_WRITE_ROLES)
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateWithholdingTaxReturnDto,
  ) {
    return this.service.update(tenant, id, dto);
  }

  @Post(':id/lines')
  @Roles(...OFFICE_WRITE_ROLES)
  addLine(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpsertWithholdingTaxLineDto,
  ) {
    return this.service.addLine(tenant, id, dto);
  }

  @Patch(':id/lines/:lineId')
  @Roles(...OFFICE_WRITE_ROLES)
  updateLine(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() dto: UpsertWithholdingTaxLineDto,
  ) {
    return this.service.updateLine(tenant, id, lineId, dto);
  }

  @Delete(':id/lines/:lineId')
  @Roles(...OFFICE_WRITE_ROLES)
  deleteLine(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
  ) {
    return this.service.deleteLine(tenant, id, lineId);
  }

  @Post(':id/ready')
  @Roles(...OFFICE_WRITE_ROLES)
  markReady(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.service.markReady(tenant, id);
  }

  @Post(':id/approve')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  approve(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.service.approve(tenant, id);
  }

  @Post(':id/reopen')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  reopen(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.service.reopen(tenant, id);
  }

  @Get(':id/aade-file')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  async aadeFile(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Res() response: Response,
  ) {
    const archive = await this.service.aadeArchive(tenant, id);
    response.setHeader('Content-Type', 'application/zip');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${archive.filename}"`,
    );
    response.send(archive.content);
  }

  @Post(':id/submit')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  submit(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: SubmitWithholdingTaxReturnDto,
  ) {
    return this.service.submit(tenant, id, dto);
  }

  @Post(':id/pay')
  @Roles(...OFFICE_WRITE_ROLES)
  pay(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: PayWithholdingTaxReturnDto,
  ) {
    return this.service.pay(tenant, id, dto);
  }
}
