import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { TenantContext } from '../common/tenant/tenant-context';
import { CreateObligationDto } from './dto/create-obligation.dto';
import { FindObligationsQueryDto } from './dto/find-obligations-query.dto';
import { GenerateMonthlyObligationsDto } from './dto/generate-monthly-obligations.dto';
import { UpdateObligationDto } from './dto/update-obligation.dto';
import { ObligationsService } from './obligations.service';

@ApiTags('obligations')
@ApiHeader({
  name: 'x-office-id',
  description: 'Temporary MVP tenant header. Later this comes from the JWT.',
  required: true,
})
@Controller('obligations')
export class ObligationsController {
  constructor(private readonly obligationsService: ObligationsService) {}

  @Get()
  findAll(@CurrentTenant() tenant: TenantContext, @Query() query: FindObligationsQueryDto) {
    return this.obligationsService.findAll(tenant, query);
  }

  @Post()
  create(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateObligationDto) {
    return this.obligationsService.create(tenant, dto);
  }

  @Post('generate-monthly')
  generateMonthly(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: GenerateMonthlyObligationsDto,
  ) {
    return this.obligationsService.generateMonthly(tenant, dto);
  }

  @Patch(':id')
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateObligationDto,
  ) {
    return this.obligationsService.update(tenant, id, dto);
  }

  @Post(':id/complete')
  complete(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.obligationsService.complete(tenant, id);
  }
}
