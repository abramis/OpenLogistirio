import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { TenantContext } from '../common/tenant/tenant-context';
import { CreateFixedAssetDto } from './dto/create-fixed-asset.dto';
import { FindFixedAssetsQueryDto } from './dto/find-fixed-assets-query.dto';
import { UpdateFixedAssetDto } from './dto/update-fixed-asset.dto';
import { FixedAssetsService } from './fixed-assets.service';

@ApiTags('fixed-assets')
@ApiHeader({
  name: 'x-office-id',
  description: 'Temporary MVP tenant header. Later this comes from the JWT.',
  required: true,
})
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
  create(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateFixedAssetDto) {
    return this.fixedAssetsService.create(tenant, dto);
  }

  @Patch(':id')
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateFixedAssetDto,
  ) {
    return this.fixedAssetsService.update(tenant, id, dto);
  }

  @Post(':id/depreciation/:year')
  generateDepreciation(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Param('year') year: string,
  ) {
    return this.fixedAssetsService.generateDepreciation(tenant, id, Number(year));
  }
}
