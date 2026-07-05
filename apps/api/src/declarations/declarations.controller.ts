import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { TenantContext } from '../common/tenant/tenant-context';
import { DeclarationsService } from './declarations.service';
import { GenerateVatWorkpaperDto } from './dto/generate-vat-workpaper.dto';

@ApiTags('declarations')
@ApiHeader({
  name: 'x-office-id',
  description: 'Temporary MVP tenant header. Later this comes from the JWT.',
  required: true,
})
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
  generateVatWorkpaper(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: GenerateVatWorkpaperDto,
  ) {
    return this.declarationsService.generateVatWorkpaper(tenant, dto);
  }
}
