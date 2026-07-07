import { Body, Controller, Get, Post } from '@nestjs/common';
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
}
