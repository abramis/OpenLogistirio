import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OFFICE_WRITE_ROLES } from '../auth/role-groups';
import { Roles } from '../auth/roles.decorator';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { TenantContext } from '../common/tenant/tenant-context';
import { DigitalMovementService } from './digital-movement.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { CompleteDispatchNoteDto } from './dto/complete-dispatch-note.dto';
import { CreateDispatchNoteDto, UpdateDispatchNoteDto } from './dto/create-dispatch-note.dto';
import { CreateInventoryItemDto, UpdateInventoryItemDto } from './dto/create-inventory-item.dto';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/create-vehicle.dto';
import { CreateWarehouseDto, UpdateWarehouseDto } from './dto/create-warehouse.dto';
import {
  CompanyScopedQueryDto,
  FindDispatchNotesQueryDto,
  FindStockMovementsQueryDto,
} from './dto/digital-movement-query.dto';

@ApiTags('digital-movement')
@Controller('digital-movement')
export class DigitalMovementController {
  constructor(private readonly service: DigitalMovementService) {}

  @Get('items')
  findItems(@CurrentTenant() tenant: TenantContext, @Query() query: CompanyScopedQueryDto) {
    return this.service.findItems(tenant, query);
  }

  @Post('items')
  @Roles(...OFFICE_WRITE_ROLES)
  createItem(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateInventoryItemDto) {
    return this.service.createItem(tenant, dto);
  }

  @Patch('items/:id')
  @Roles(...OFFICE_WRITE_ROLES)
  updateItem(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateInventoryItemDto,
  ) {
    return this.service.updateItem(tenant, id, dto);
  }

  @Get('warehouses')
  findWarehouses(@CurrentTenant() tenant: TenantContext, @Query() query: CompanyScopedQueryDto) {
    return this.service.findWarehouses(tenant, query);
  }

  @Post('warehouses')
  @Roles(...OFFICE_WRITE_ROLES)
  createWarehouse(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateWarehouseDto) {
    return this.service.createWarehouse(tenant, dto);
  }

  @Patch('warehouses/:id')
  @Roles(...OFFICE_WRITE_ROLES)
  updateWarehouse(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateWarehouseDto,
  ) {
    return this.service.updateWarehouse(tenant, id, dto);
  }

  @Get('vehicles')
  findVehicles(@CurrentTenant() tenant: TenantContext, @Query() query: CompanyScopedQueryDto) {
    return this.service.findVehicles(tenant, query);
  }

  @Post('vehicles')
  @Roles(...OFFICE_WRITE_ROLES)
  createVehicle(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateVehicleDto) {
    return this.service.createVehicle(tenant, dto);
  }

  @Patch('vehicles/:id')
  @Roles(...OFFICE_WRITE_ROLES)
  updateVehicle(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.service.updateVehicle(tenant, id, dto);
  }

  @Get('dispatch-notes')
  findDispatchNotes(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: FindDispatchNotesQueryDto,
  ) {
    return this.service.findDispatchNotes(tenant, query);
  }

  @Get('dispatch-notes/:id')
  findDispatchNote(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.service.findDispatchNote(tenant, id);
  }

  @Post('dispatch-notes')
  @Roles(...OFFICE_WRITE_ROLES)
  createDispatchNote(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateDispatchNoteDto) {
    return this.service.createDispatchNote(tenant, dto);
  }

  @Patch('dispatch-notes/:id')
  @Roles(...OFFICE_WRITE_ROLES)
  updateDispatchNote(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateDispatchNoteDto,
  ) {
    return this.service.updateDispatchNote(tenant, id, dto);
  }

  @Post('dispatch-notes/:id/issue')
  @Roles(...OFFICE_WRITE_ROLES)
  issueDispatchNote(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.service.issueDispatchNote(tenant, id);
  }

  @Post('dispatch-notes/:id/complete')
  @Roles(...OFFICE_WRITE_ROLES)
  completeDispatchNote(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: CompleteDispatchNoteDto,
  ) {
    return this.service.completeDispatchNote(tenant, id, dto);
  }

  @Post('dispatch-notes/:id/cancel')
  @Roles(...OFFICE_WRITE_ROLES)
  cancelDispatchNote(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.service.cancelDispatchNote(tenant, id);
  }

  @Get('stock')
  findStock(@CurrentTenant() tenant: TenantContext, @Query() query: CompanyScopedQueryDto) {
    return this.service.findStock(tenant, query);
  }

  @Get('stock/movements')
  findStockMovements(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: FindStockMovementsQueryDto,
  ) {
    return this.service.findStockMovements(tenant, query);
  }

  @Post('stock/adjust')
  @Roles(...OFFICE_WRITE_ROLES)
  adjustStock(@CurrentTenant() tenant: TenantContext, @Body() dto: AdjustStockDto) {
    return this.service.adjustStock(tenant, dto);
  }
}
