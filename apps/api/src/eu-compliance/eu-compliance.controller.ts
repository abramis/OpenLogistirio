import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
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
  GenerateIntrastatReturnDto,
  GenerateViesReturnDto,
  SubmitComplianceReturnDto,
  UpsertIntrastatLineDto,
  UpsertViesLineDto,
} from './dto/eu-compliance.dto';
import { IntrastatService } from './intrastat.service';
import { ViesService } from './vies.service';

@ApiTags('eu-compliance')
@Controller('eu-compliance')
export class EuComplianceController {
  constructor(
    private readonly vies: ViesService,
    private readonly intrastat: IntrastatService,
  ) {}

  @Get('vies/metadata') metadataVies() {
    return this.vies.metadata();
  }
  @Get('vies') findVies(
    @CurrentTenant() tenant: TenantContext,
    @Query('clientCompanyId') clientCompanyId?: string,
    @Query('periodYear') periodYear?: string,
  ) {
    return this.vies.findAll(tenant, clientCompanyId, periodYear ? Number(periodYear) : undefined);
  }
  @Post('vies/generate')
  @Roles(...OFFICE_WRITE_ROLES)
  generateVies(@CurrentTenant() tenant: TenantContext, @Body() dto: GenerateViesReturnDto) {
    return this.vies.generate(tenant, dto);
  }
  @Post('vies/:id/corrective')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  correctiveVies(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.vies.corrective(tenant, id);
  }
  @Post('vies/:id/lines')
  @Roles(...OFFICE_WRITE_ROLES)
  addViesLine(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpsertViesLineDto,
  ) {
    return this.vies.upsertLine(tenant, id, undefined, dto);
  }
  @Patch('vies/:id/lines/:lineId')
  @Roles(...OFFICE_WRITE_ROLES)
  updateViesLine(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() dto: UpsertViesLineDto,
  ) {
    return this.vies.upsertLine(tenant, id, lineId, dto);
  }
  @Delete('vies/:id/lines/:lineId')
  @Roles(...OFFICE_WRITE_ROLES)
  deleteViesLine(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
  ) {
    return this.vies.deleteLine(tenant, id, lineId);
  }
  @Post('vies/:id/lines/:lineId/check-vat')
  @Roles(...OFFICE_WRITE_ROLES)
  checkViesVat(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
  ) {
    return this.vies.checkVat(tenant, id, lineId);
  }
  @Post('vies/:id/ready')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  readyVies(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.vies.ready(tenant, id);
  }
  @Get('vies/:id/file')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  @Header('Content-Type', 'application/xml')
  async viesFile(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.vies.file(tenant, id);
    response.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    response.setHeader('X-Checksum-SHA256', file.checksumSha256);
    return file.content;
  }
  @Post('vies/:id/submit')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  submitVies(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: SubmitComplianceReturnDto,
  ) {
    return this.vies.submit(tenant, id, dto);
  }
  @Post('vies/:id/lock')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  lockVies(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.vies.lock(tenant, id);
  }

  @Get('intrastat/metadata') metadataIntrastat() {
    return this.intrastat.metadata();
  }
  @Get('intrastat') findIntrastat(
    @CurrentTenant() tenant: TenantContext,
    @Query('clientCompanyId') clientCompanyId?: string,
    @Query('periodYear') periodYear?: string,
  ) {
    return this.intrastat.findAll(
      tenant,
      clientCompanyId,
      periodYear ? Number(periodYear) : undefined,
    );
  }
  @Post('intrastat/generate')
  @Roles(...OFFICE_WRITE_ROLES)
  generateIntrastat(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: GenerateIntrastatReturnDto,
  ) {
    return this.intrastat.generate(tenant, dto);
  }
  @Post('intrastat/:id/corrective')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  correctiveIntrastat(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.intrastat.corrective(tenant, id);
  }
  @Post('intrastat/:id/lines')
  @Roles(...OFFICE_WRITE_ROLES)
  addIntrastatLine(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpsertIntrastatLineDto,
  ) {
    return this.intrastat.upsertLine(tenant, id, undefined, dto);
  }
  @Patch('intrastat/:id/lines/:lineId')
  @Roles(...OFFICE_WRITE_ROLES)
  updateIntrastatLine(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() dto: UpsertIntrastatLineDto,
  ) {
    return this.intrastat.upsertLine(tenant, id, lineId, dto);
  }
  @Delete('intrastat/:id/lines/:lineId')
  @Roles(...OFFICE_WRITE_ROLES)
  deleteIntrastatLine(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
  ) {
    return this.intrastat.deleteLine(tenant, id, lineId);
  }
  @Post('intrastat/:id/ready')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  readyIntrastat(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.intrastat.ready(tenant, id);
  }
  @Get('intrastat/:id/file')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  @Header('Content-Type', 'text/plain; charset=us-ascii')
  async intrastatFile(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.intrastat.file(tenant, id);
    response.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    response.setHeader('X-Checksum-SHA256', file.checksumSha256);
    return file.content;
  }
  @Post('intrastat/:id/submit')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  submitIntrastat(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: SubmitComplianceReturnDto,
  ) {
    return this.intrastat.submit(tenant, id, dto);
  }
  @Post('intrastat/:id/lock')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  lockIntrastat(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.intrastat.lock(tenant, id);
  }
}
