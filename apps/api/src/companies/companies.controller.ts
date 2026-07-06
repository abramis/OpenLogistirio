import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { TenantContext } from '../common/tenant/tenant-context';
import { AadeRegistryProvider } from './aade-registry.provider';
import { CompaniesService } from './companies.service';
import { AadeRegistryLookupDto } from './dto/aade-registry-lookup.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@ApiTags('companies')
@ApiHeader({
  name: 'x-office-id',
  description: 'Temporary MVP tenant header. Later this comes from the JWT.',
  required: true,
})
@ApiHeader({
  name: 'x-user-id',
  description: 'Temporary MVP user header for audit logs.',
  required: false,
})
@Controller('companies')
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly aadeRegistryProvider: AadeRegistryProvider,
  ) {}

  @Get()
  findAll(@CurrentTenant() tenant: TenantContext) {
    return this.companiesService.findAll(tenant);
  }

  @Get(':id')
  findOne(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.companiesService.findOne(tenant, id);
  }

  @Post()
  create(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateCompanyDto) {
    return this.companiesService.create(tenant, dto);
  }

  @Post('aade/lookup')
  lookupAadeRegistry(@Body() dto: AadeRegistryLookupDto) {
    return this.aadeRegistryProvider.lookupVat(dto.vatNumber);
  }

  @Patch(':id')
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companiesService.update(tenant, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    await this.companiesService.softDelete(tenant, id);
  }
}
