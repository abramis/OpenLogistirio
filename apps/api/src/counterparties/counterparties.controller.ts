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
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { TenantContext } from '../common/tenant/tenant-context';
import { CounterpartiesService } from './counterparties.service';
import { CreateCounterpartyDto } from './dto/create-counterparty.dto';
import { FindCounterpartiesQueryDto } from './dto/find-counterparties-query.dto';
import { UpdateCounterpartyDto } from './dto/update-counterparty.dto';

@ApiTags('counterparties')
@ApiHeader({
  name: 'x-office-id',
  description: 'Temporary MVP tenant header. Later this comes from the JWT.',
  required: true,
})
@Controller('counterparties')
export class CounterpartiesController {
  constructor(private readonly counterpartiesService: CounterpartiesService) {}

  @Get()
  findAll(@CurrentTenant() tenant: TenantContext, @Query() query: FindCounterpartiesQueryDto) {
    return this.counterpartiesService.findAll(tenant, query);
  }

  @Post()
  create(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateCounterpartyDto) {
    return this.counterpartiesService.create(tenant, dto);
  }

  @Patch(':id')
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateCounterpartyDto,
  ) {
    return this.counterpartiesService.update(tenant, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    await this.counterpartiesService.softDelete(tenant, id);
  }
}
