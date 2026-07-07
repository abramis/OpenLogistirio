import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OFFICE_WRITE_ROLES } from '../auth/role-groups';
import { Roles } from '../auth/roles.decorator';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { TenantContext } from '../common/tenant/tenant-context';
import { CreateFixedAssetDto } from './dto/create-fixed-asset.dto';
import { FindFixedAssetsQueryDto } from './dto/find-fixed-assets-query.dto';
import { UpdateFixedAssetDto } from './dto/update-fixed-asset.dto';
import { FixedAssetsService } from './fixed-assets.service';

@ApiTags('fixed-assets')
@Controller('fixed-assets')
export class FixedAssetsController {
  constructor(private readonly fixedAssetsService: FixedAssetsService) {}

  @Get()
  findAll(@CurrentTenant() tenant: TenantContext, @Query() query: FindFixedAssetsQueryDto) {
    return this.fixedAssetsService.findAll(tenant, query);
  }

  @Get(':id')
  findOne(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.fixedAssetsService.findOne(tenant, id);
  }

  @Post()
  @Roles(...OFFICE_WRITE_ROLES)
  create(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateFixedAssetDto) {
    return this.fixedAssetsService.create(tenant, dto);
  }

  @Patch(':id')
  @Roles(...OFFICE_WRITE_ROLES)
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateFixedAssetDto,
  ) {
    return this.fixedAssetsService.update(tenant, id, dto);
  }

  @Post(':id/depreciation/:year')
  @Roles(...OFFICE_WRITE_ROLES)
  generateDepreciation(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Param('year') year: string,
  ) {
    return this.fixedAssetsService.generateDepreciation(tenant, id, Number(year));
  }
}
