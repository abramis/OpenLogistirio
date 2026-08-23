import { Body, Controller, Get, Header, Param, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ACCOUNTING_CONTROL_ROLES, OFFICE_WRITE_ROLES } from '../auth/role-groups';
import { Roles } from '../auth/roles.decorator';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { TenantContext } from '../common/tenant/tenant-context';
import { AnnualCertificatesService } from './annual-certificates.service';
import {
  GenerateAnnualCertificateDto,
  SubmitAnnualCertificateDto,
} from './dto/annual-certificate.dto';

@ApiTags('annual-certificates')
@Controller('annual-certificates')
export class AnnualCertificatesController {
  constructor(private readonly service: AnnualCertificatesService) {}

  @Get('metadata')
  metadata() {
    return this.service.metadata();
  }

  @Get()
  findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query('clientCompanyId') clientCompanyId?: string,
    @Query('fiscalYear') fiscalYear?: string,
  ) {
    return this.service.findAll(
      tenant,
      clientCompanyId,
      fiscalYear ? Number(fiscalYear) : undefined,
    );
  }

  @Post('generate')
  @Roles(...OFFICE_WRITE_ROLES)
  generate(@CurrentTenant() tenant: TenantContext, @Body() dto: GenerateAnnualCertificateDto) {
    return this.service.generate(tenant, dto);
  }

  @Post(':id/refresh')
  @Roles(...OFFICE_WRITE_ROLES)
  refresh(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.service.refresh(tenant, id);
  }

  @Post(':id/ready')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  ready(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.service.markReady(tenant, id);
  }

  @Get(':id/file')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  @Header('Content-Type', 'application/zip')
  async file(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const archive = await this.service.file(tenant, id);
    response.setHeader('Content-Disposition', `attachment; filename="${archive.filename}"`);
    response.setHeader('X-Checksum-SHA256', archive.checksumSha256);
    return archive.content;
  }

  @Post(':id/submit')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  submit(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: SubmitAnnualCertificateDto,
  ) {
    return this.service.submit(tenant, id, dto);
  }

  @Post(':id/lock')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  lock(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.service.lock(tenant, id);
  }
}
