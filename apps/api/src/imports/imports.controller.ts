import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { TenantContext } from '../common/tenant/tenant-context';
import { ImportDocumentsCsvDto } from './dto/import-documents-csv.dto';
import { ImportsService } from './imports.service';

@ApiTags('imports')
@ApiHeader({
  name: 'x-office-id',
  description: 'Temporary MVP tenant header. Later this comes from the JWT.',
  required: true,
})
@Controller('imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Get()
  history(@CurrentTenant() tenant: TenantContext) {
    return this.importsService.history(tenant);
  }

  @Post('documents-csv')
  importDocumentsCsv(@CurrentTenant() tenant: TenantContext, @Body() dto: ImportDocumentsCsvDto) {
    return this.importsService.importDocumentsCsv(tenant, dto);
  }
}
