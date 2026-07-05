import { Controller, Get, Query } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { TenantContext } from '../common/tenant/tenant-context';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiHeader({
  name: 'x-office-id',
  description: 'Temporary MVP tenant header. Later this comes from the JWT.',
  required: true,
})
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('office-summary')
  officeSummary(@CurrentTenant() tenant: TenantContext) {
    return this.reportsService.officeSummary(tenant);
  }

  @Get('vat-summary')
  vatSummary(
    @CurrentTenant() tenant: TenantContext,
    @Query('year') year?: string,
    @Query('clientCompanyId') clientCompanyId?: string,
  ) {
    return this.reportsService.vatSummary(
      tenant,
      year ? Number(year) : new Date().getFullYear(),
      clientCompanyId,
    );
  }
}
