import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OFFICE_WRITE_ROLES } from '../auth/role-groups';
import { Roles } from '../auth/roles.decorator';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { TenantContext } from '../common/tenant/tenant-context';
import { CreateObligationDto } from './dto/create-obligation.dto';
import { FindObligationsQueryDto } from './dto/find-obligations-query.dto';
import { GenerateMonthlyObligationsDto } from './dto/generate-monthly-obligations.dto';
import { UpdateObligationDto } from './dto/update-obligation.dto';
import { ObligationsService } from './obligations.service';

@ApiTags('obligations')
@Controller('obligations')
export class ObligationsController {
  constructor(private readonly obligationsService: ObligationsService) {}

  @Get()
  findAll(@CurrentTenant() tenant: TenantContext, @Query() query: FindObligationsQueryDto) {
    return this.obligationsService.findAll(tenant, query);
  }

  @Post()
  @Roles(...OFFICE_WRITE_ROLES)
  create(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateObligationDto) {
    return this.obligationsService.create(tenant, dto);
  }

  @Post('generate-monthly')
  @Roles(...OFFICE_WRITE_ROLES)
  generateMonthly(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: GenerateMonthlyObligationsDto,
  ) {
    return this.obligationsService.generateMonthly(tenant, dto);
  }

  @Patch(':id')
  @Roles(...OFFICE_WRITE_ROLES)
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateObligationDto,
  ) {
    return this.obligationsService.update(tenant, id, dto);
  }

  @Post(':id/complete')
  @Roles(...OFFICE_WRITE_ROLES)
  complete(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.obligationsService.complete(tenant, id);
  }
}
