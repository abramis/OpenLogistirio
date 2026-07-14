import { Body, Controller, Get, Header, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OFFICE_WRITE_ROLES } from '../auth/role-groups';
import { Roles } from '../auth/roles.decorator';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { TenantContext } from '../common/tenant/tenant-context';
import { ImportDocumentsCsvDto } from './dto/import-documents-csv.dto';
import { ImportsService } from './imports.service';

@ApiTags('imports')
@Controller('imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Get()
  history(@CurrentTenant() tenant: TenantContext) {
    return this.importsService.history(tenant);
  }

  @Post('documents-csv')
  @Roles(...OFFICE_WRITE_ROLES)
  importDocumentsCsv(@CurrentTenant() tenant: TenantContext, @Body() dto: ImportDocumentsCsvDto) {
    return this.importsService.importDocumentsCsv(tenant, dto);
  }

  @Get(':id/error-report')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  errorReport(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.importsService.errorReportCsv(tenant, id);
  }

  @Post(':id/rollback')
  @Roles(...OFFICE_WRITE_ROLES)
  rollback(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.importsService.rollback(tenant, id);
  }
}
