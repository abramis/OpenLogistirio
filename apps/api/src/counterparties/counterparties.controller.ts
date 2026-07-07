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
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OFFICE_WRITE_ROLES } from '../auth/role-groups';
import { Roles } from '../auth/roles.decorator';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { TenantContext } from '../common/tenant/tenant-context';
import { CounterpartiesService } from './counterparties.service';
import { CreateCounterpartyDto } from './dto/create-counterparty.dto';
import { FindCounterpartiesQueryDto } from './dto/find-counterparties-query.dto';
import { UpdateCounterpartyDto } from './dto/update-counterparty.dto';

@ApiTags('counterparties')
@Controller('counterparties')
export class CounterpartiesController {
  constructor(private readonly counterpartiesService: CounterpartiesService) {}

  @Get()
  findAll(@CurrentTenant() tenant: TenantContext, @Query() query: FindCounterpartiesQueryDto) {
    return this.counterpartiesService.findAll(tenant, query);
  }

  @Post()
  @Roles(...OFFICE_WRITE_ROLES)
  create(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateCounterpartyDto) {
    return this.counterpartiesService.create(tenant, dto);
  }

  @Patch(':id')
  @Roles(...OFFICE_WRITE_ROLES)
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateCounterpartyDto,
  ) {
    return this.counterpartiesService.update(tenant, id, dto);
  }

  @Delete(':id')
  @Roles(...OFFICE_WRITE_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    await this.counterpartiesService.softDelete(tenant, id);
  }
}
