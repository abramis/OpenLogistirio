import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { TenantContext } from '../common/tenant/tenant-context';
import { ClientSetupService } from './client-setup.service';
import { ApplyClientSetupTemplateDto } from './dto/apply-client-setup-template.dto';

@ApiTags('client-setup')
@ApiHeader({
  name: 'x-office-id',
  description: 'Temporary MVP tenant header. Later this comes from the JWT.',
  required: true,
})
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
  applyTemplate(
    @CurrentTenant() tenant: TenantContext,
    @Param('clientCompanyId') clientCompanyId: string,
    @Body() dto: ApplyClientSetupTemplateDto,
  ) {
    return this.clientSetupService.applyTemplate(tenant, clientCompanyId, dto);
  }
}
