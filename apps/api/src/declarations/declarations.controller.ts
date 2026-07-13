import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ACCOUNTING_CONTROL_ROLES, OFFICE_WRITE_ROLES } from '../auth/role-groups';
import { Roles } from '../auth/roles.decorator';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { TenantContext } from '../common/tenant/tenant-context';
import { DeclarationsService } from './declarations.service';
import { GenerateVatWorkpaperDto } from './dto/generate-vat-workpaper.dto';

@ApiTags('declarations')
@Controller('declarations')
export class DeclarationsController {
  constructor(private readonly declarationsService: DeclarationsService) {}

  @Get('workpapers')
  findWorkpapers(
    @CurrentTenant() tenant: TenantContext,
    @Query('clientCompanyId') clientCompanyId?: string,
  ) {
    return this.declarationsService.findWorkpapers(tenant, clientCompanyId);
  }

  @Post('vat-workpaper/generate')
  @Roles(...OFFICE_WRITE_ROLES)
  generateVatWorkpaper(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: GenerateVatWorkpaperDto,
  ) {
    return this.declarationsService.generateVatWorkpaper(tenant, dto);
  }

  @Post('workpapers/:id/ready')
  @Roles(...OFFICE_WRITE_ROLES)
  markReady(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.declarationsService.markReady(tenant, id);
  }

  @Post('workpapers/:id/approve')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  approve(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.declarationsService.approve(tenant, id);
  }
}
