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
import { ApiTags } from '@nestjs/swagger';
import { OFFICE_WRITE_ROLES } from '../auth/role-groups';
import { Roles } from '../auth/roles.decorator';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { TenantContext } from '../common/tenant/tenant-context';
import { AadeRegistryProvider } from './aade-registry.provider';
import { CompaniesService } from './companies.service';
import { AadeRegistryLookupDto } from './dto/aade-registry-lookup.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@ApiTags('companies')
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
  @Roles(...OFFICE_WRITE_ROLES)
  create(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateCompanyDto) {
    return this.companiesService.create(tenant, dto);
  }

  @Post('aade/lookup')
  lookupAadeRegistry(@Body() dto: AadeRegistryLookupDto) {
    return this.aadeRegistryProvider.lookupVat(dto.vatNumber);
  }

  @Patch(':id')
  @Roles(...OFFICE_WRITE_ROLES)
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companiesService.update(tenant, id, dto);
  }

  @Delete(':id')
  @Roles(...OFFICE_WRITE_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    await this.companiesService.softDelete(tenant, id);
  }
}
