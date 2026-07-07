import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OFFICE_WRITE_ROLES } from '../auth/role-groups';
import { Roles } from '../auth/roles.decorator';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { TenantContext } from '../common/tenant/tenant-context';
import { ClientSetupService } from './client-setup.service';
import { ApplyClientSetupTemplateDto } from './dto/apply-client-setup-template.dto';

@ApiTags('client-setup')
@Controller('companies/:clientCompanyId/setup')
export class ClientSetupController {
  constructor(private readonly clientSetupService: ClientSetupService) {}

  @Get('templates')
  listTemplates() {
    return this.clientSetupService.listTemplates();
  }

  @Get()
  findItems(
    @CurrentTenant() tenant: TenantContext,
    @Param('clientCompanyId') clientCompanyId: string,
  ) {
    return this.clientSetupService.findItems(tenant, clientCompanyId);
  }

  @Post('apply')
  @Roles(...OFFICE_WRITE_ROLES)
  applyTemplate(
    @CurrentTenant() tenant: TenantContext,
    @Param('clientCompanyId') clientCompanyId: string,
    @Body() dto: ApplyClientSetupTemplateDto,
  ) {
    return this.clientSetupService.applyTemplate(tenant, clientCompanyId, dto);
  }
}
