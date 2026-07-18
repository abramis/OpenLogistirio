import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  DeliveryOutcome,
  DispatchEventType,
  DispatchNoteStatus,
  Prisma,
  StockMovementKind,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { CompleteDispatchNoteDto } from './dto/complete-dispatch-note.dto';
import {
  CreateDispatchNoteDto,
  CreateDispatchNoteLineDto,
  UpdateDispatchNoteDto,
} from './dto/create-dispatch-note.dto';
import { CreateInventoryItemDto, UpdateInventoryItemDto } from './dto/create-inventory-item.dto';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/create-vehicle.dto';
import { CreateWarehouseDto, UpdateWarehouseDto } from './dto/create-warehouse.dto';
import {
  CompanyScopedQueryDto,
  FindDispatchNotesQueryDto,
  FindStockMovementsQueryDto,
} from './dto/digital-movement-query.dto';

const dispatchInclude = {
  clientCompany: { select: { id: true, legalName: true, vatNumber: true } },
  counterparty: true,
  loadingWarehouse: true,
  deliveryWarehouse: true,
  vehicle: true,
  lines: { include: { item: true }, orderBy: { lineNumber: 'asc' as const } },
  deliveryReceipt: { include: { lines: true } },
  lifecycleEvents: { orderBy: { eventAt: 'asc' as const } },
};

@Injectable()
export class DigitalMovementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findItems(tenant: TenantContext, query: CompanyScopedQueryDto = {}) {
    return this.prisma.inventoryItem.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: query.clientCompanyId,
        deletedAt: null,
      },
      include: { clientCompany: { select: { id: true, legalName: true } } },
      orderBy: [{ clientCompany: { legalName: 'asc' } }, { code: 'asc' }],
    });
  }

  async createItem(tenant: TenantContext, dto: CreateInventoryItemDto) {
    await this.ensureCompany(tenant, dto.clientCompanyId);
    const item = await this.prisma.inventoryItem.create({
      data: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: dto.clientCompanyId,
        code: dto.code.trim(),
        name: dto.name.trim(),
        description: dto.description,
        measurementUnit: dto.measurementUnit,
        trackInventory: dto.trackInventory ?? true,
      },
    });
    await this.audit(tenant, AuditAction.CREATE, 'InventoryItem', item.id, item);
    return item;
  }

  async updateItem(tenant: TenantContext, id: string, dto: UpdateInventoryItemDto) {
    const existing = await this.getItem(tenant, id);
    const item = await this.prisma.inventoryItem.update({
      where: { id: existing.id },
      data: dto,
    });
    await this.audit(tenant, AuditAction.UPDATE, 'InventoryItem', item.id, item);
    return item;
  }

  findWarehouses(tenant: TenantContext, query: CompanyScopedQueryDto = {}) {
    return this.prisma.warehouse.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: query.clientCompanyId,
        deletedAt: null,
      },
      include: { clientCompany: { select: { id: true, legalName: true } } },
      orderBy: [{ clientCompany: { legalName: 'asc' } }, { code: 'asc' }],
    });
  }

  async createWarehouse(tenant: TenantContext, dto: CreateWarehouseDto) {
    await this.ensureCompany(tenant, dto.clientCompanyId);
    const warehouse = await this.prisma.warehouse.create({
      data: {
        accountingOfficeId: tenant.accountingOfficeId,
        ...dto,
        code: dto.code.trim(),
        name: dto.name.trim(),
      },
    });
    await this.audit(tenant, AuditAction.CREATE, 'Warehouse', warehouse.id, warehouse);
    return warehouse;
  }

  async updateWarehouse(tenant: TenantContext, id: string, dto: UpdateWarehouseDto) {
    const existing = await this.getWarehouse(tenant, id);
    const warehouse = await this.prisma.warehouse.update({ where: { id: existing.id }, data: dto });
    await this.audit(tenant, AuditAction.UPDATE, 'Warehouse', warehouse.id, warehouse);
    return warehouse;
  }

  findVehicles(tenant: TenantContext, query: CompanyScopedQueryDto = {}) {
    return this.prisma.vehicle.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: query.clientCompanyId,
        deletedAt: null,
      },
      include: { clientCompany: { select: { id: true, legalName: true } } },
      orderBy: [{ clientCompany: { legalName: 'asc' } }, { registrationNumber: 'asc' }],
    });
  }

  async createVehicle(tenant: TenantContext, dto: CreateVehicleDto) {
    await this.ensureCompany(tenant, dto.clientCompanyId);
    const vehicle = await this.prisma.vehicle.create({
      data: {
        accountingOfficeId: tenant.accountingOfficeId,
        ...dto,
        registrationNumber: dto.registrationNumber.trim().toUpperCase(),
      },
    });
    await this.audit(tenant, AuditAction.CREATE, 'Vehicle', vehicle.id, vehicle);
    return vehicle;
  }

  async updateVehicle(tenant: TenantContext, id: string, dto: UpdateVehicleDto) {
    const existing = await this.getVehicle(tenant, id);
    const vehicle = await this.prisma.vehicle.update({
      where: { id: existing.id },
      data: {
        ...dto,
        registrationNumber: dto.registrationNumber?.trim().toUpperCase(),
      },
    });
    await this.audit(tenant, AuditAction.UPDATE, 'Vehicle', vehicle.id, vehicle);
    return vehicle;
  }

  findDispatchNotes(tenant: TenantContext, query: FindDispatchNotesQueryDto = {}) {
    return this.prisma.dispatchNote.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: query.clientCompanyId,
        status: query.status,
      },
      include: dispatchInclude,
      orderBy: [{ plannedDispatchAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findDispatchNote(tenant: TenantContext, id: string) {
    return this.getDispatch(tenant, id);
  }

  async createDispatchNote(tenant: TenantContext, dto: CreateDispatchNoteDto) {
    this.validateHeaderMovePurpose(dto.movePurpose, dto.otherMovePurposeTitle);
    const resolved = await this.resolveDispatchReferences(tenant, dto.clientCompanyId, dto);
    const loadingAddress = dto.loadingAddress ?? resolved.loadingWarehouse.address ?? '';
    const deliveryAddress =
      dto.deliveryAddress ||
      resolved.deliveryWarehouse?.address ||
      resolved.counterparty?.address ||
      '';
    this.assertMovementAddresses(loadingAddress, deliveryAddress);
    const note = await this.prisma.dispatchNote.create({
      data: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: dto.clientCompanyId,
        series: dto.series.trim(),
        number: dto.number.trim(),
        issueDate: new Date(dto.issueDate),
        plannedDispatchAt: new Date(dto.plannedDispatchAt),
        movePurpose: dto.movePurpose,
        otherMovePurposeTitle: dto.otherMovePurposeTitle,
        counterpartyId: resolved.counterparty?.id,
        recipientName: dto.recipientName ?? resolved.counterparty?.name,
        recipientVatNumber: dto.recipientVatNumber ?? resolved.counterparty?.vatNumber,
        loadingWarehouseId: resolved.loadingWarehouse.id,
        deliveryWarehouseId: resolved.deliveryWarehouse?.id,
        vehicleId: resolved.vehicle?.id,
        vehicleNumber: dto.vehicleNumber ?? resolved.vehicle?.registrationNumber,
        loadingAddress,
        deliveryAddress,
        notes: dto.notes,
        lines: { create: this.snapshotLines(dto.lines, resolved.items) },
        lifecycleEvents: {
          create: {
            accountingOfficeId: tenant.accountingOfficeId,
            clientCompanyId: dto.clientCompanyId,
            eventType: DispatchEventType.CREATED,
            eventAt: new Date(),
          },
        },
      },
      include: dispatchInclude,
    });
    await this.audit(tenant, AuditAction.CREATE, 'DispatchNote', note.id, this.noteAudit(note));
    return note;
  }

  async updateDispatchNote(tenant: TenantContext, id: string, dto: UpdateDispatchNoteDto) {
    const existing = await this.getDispatch(tenant, id);
    if (existing.status !== DispatchNoteStatus.DRAFT) {
      throw new BadRequestException('Only draft dispatch notes can be edited.');
    }
    this.validateHeaderMovePurpose(
      dto.movePurpose ?? existing.movePurpose,
      dto.otherMovePurposeTitle ?? existing.otherMovePurposeTitle ?? undefined,
    );

    const merged = {
      counterpartyId: dto.counterpartyId ?? existing.counterpartyId ?? undefined,
      loadingWarehouseId: dto.loadingWarehouseId ?? existing.loadingWarehouseId,
      deliveryWarehouseId:
        dto.deliveryWarehouseId === ''
          ? undefined
          : (dto.deliveryWarehouseId ?? existing.deliveryWarehouseId ?? undefined),
      vehicleId:
        dto.vehicleId === '' ? undefined : (dto.vehicleId ?? existing.vehicleId ?? undefined),
      lines:
        dto.lines ??
        existing.lines.map((line) => ({
          itemId: line.itemId,
          quantity: Number(line.quantity),
          movePurposeLine: line.movePurposeLine ?? undefined,
          otherMovePurposeLineTitle: line.otherMovePurposeLineTitle ?? undefined,
        })),
    };
    const resolved = await this.resolveDispatchReferences(tenant, existing.clientCompanyId, merged);
    const loadingAddress =
      dto.loadingAddress ?? resolved.loadingWarehouse.address ?? existing.loadingAddress;
    const deliveryAddress =
      dto.deliveryAddress ??
      resolved.deliveryWarehouse?.address ??
      resolved.counterparty?.address ??
      existing.deliveryAddress;
    this.assertMovementAddresses(loadingAddress, deliveryAddress);

    const note = await this.prisma.$transaction(async (tx) => {
      if (dto.lines) {
        await tx.dispatchNoteLine.deleteMany({ where: { dispatchNoteId: existing.id } });
      }
      return tx.dispatchNote.update({
        where: { id: existing.id },
        data: {
          series: dto.series,
          number: dto.number,
          issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
          plannedDispatchAt: dto.plannedDispatchAt ? new Date(dto.plannedDispatchAt) : undefined,
          movePurpose: dto.movePurpose,
          otherMovePurposeTitle: dto.otherMovePurposeTitle,
          counterpartyId: resolved.counterparty?.id,
          recipientName: dto.recipientName,
          recipientVatNumber: dto.recipientVatNumber,
          loadingWarehouseId: resolved.loadingWarehouse.id,
          deliveryWarehouseId:
            dto.deliveryWarehouseId === '' ? null : resolved.deliveryWarehouse?.id,
          vehicleId: dto.vehicleId === '' ? null : resolved.vehicle?.id,
          vehicleNumber: dto.vehicleNumber ?? resolved.vehicle?.registrationNumber,
          loadingAddress,
          deliveryAddress,
          notes: dto.notes,
          lines: dto.lines ? { create: this.snapshotLines(dto.lines, resolved.items) } : undefined,
        },
        include: dispatchInclude,
      });
    });
    await this.prisma.dispatchLifecycleEvent.create({
      data: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: note.clientCompanyId,
        dispatchNoteId: note.id,
        eventType: DispatchEventType.UPDATED,
        eventAt: new Date(),
      },
    });
    await this.audit(tenant, AuditAction.UPDATE, 'DispatchNote', note.id, this.noteAudit(note));
    return note;
  }

  async issueDispatchNote(tenant: TenantContext, id: string) {
    const existing = await this.getDispatch(tenant, id);
    if (existing.status !== DispatchNoteStatus.DRAFT) {
      throw new BadRequestException('Only draft dispatch notes can be issued.');
    }

    const issuedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      for (const line of existing.lines) {
        if (!line.item.trackInventory) continue;
        await this.decreaseStock(
          tx,
          existing.loadingWarehouseId,
          line.itemId,
          Number(line.quantity),
        );
        await this.createMovement(
          tx,
          existing,
          line,
          existing.loadingWarehouseId,
          StockMovementKind.DISPATCH_OUT,
          Number(line.quantity),
          issuedAt,
        );
      }
      await tx.dispatchNote.update({
        where: { id: existing.id },
        data: { status: DispatchNoteStatus.ISSUED, issuedAt },
      });
      await this.createLifecycleEvent(tx, existing, DispatchEventType.ISSUED, issuedAt, {
        vehicleNumber: existing.vehicleNumber,
      });
    });
    await this.audit(tenant, AuditAction.UPDATE, 'DispatchNote', id, { status: 'ISSUED' });
    return this.getDispatch(tenant, id);
  }

  async completeDispatchNote(
    tenant: TenantContext,
    id: string,
    dto: CompleteDispatchNoteDto = {},
  ) {
    const existing = await this.getDispatch(tenant, id);
    if (existing.status !== DispatchNoteStatus.ISSUED) {
      throw new BadRequestException('Only issued dispatch notes can be completed.');
    }

    const completedAt = dto.receivedAt ? new Date(dto.receivedAt) : new Date();
    const receiptLines = this.resolveReceiptLines(existing.lines, dto);
    const outcome = this.deliveryOutcome(receiptLines);
    const status = this.deliveryStatus(outcome);
    const eventType = this.deliveryEventType(outcome);
    await this.prisma.$transaction(async (tx) => {
      if (existing.deliveryWarehouseId) {
        for (const line of existing.lines) {
          if (!line.item.trackInventory) continue;
          const receiptLine = receiptLines.find((candidate) => candidate.dispatchNoteLineId === line.id)!;
          if (receiptLine.acceptedQuantity === 0) continue;
          await this.increaseStock(
            tx,
            existing.deliveryWarehouseId,
            line.itemId,
            receiptLine.acceptedQuantity,
          );
          await this.createMovement(
            tx,
            existing,
            line,
            existing.deliveryWarehouseId,
            StockMovementKind.DELIVERY_IN,
            receiptLine.acceptedQuantity,
            completedAt,
          );
        }
      }
      await tx.dispatchDeliveryReceipt.create({
        data: {
          accountingOfficeId: existing.accountingOfficeId,
          clientCompanyId: existing.clientCompanyId,
          dispatchNoteId: existing.id,
          outcome,
          deliveredWithoutRecipient: dto.deliveredWithoutRecipient ?? false,
          receivedAt: completedAt,
          notes: dto.notes,
          lines: { create: receiptLines },
        },
      });
      await tx.dispatchNote.update({
        where: { id: existing.id },
        data: { status, completedAt },
      });
      await this.createLifecycleEvent(tx, existing, eventType, completedAt, {
        outcome,
        acceptedQuantity: receiptLines.reduce((sum, line) => sum + line.acceptedQuantity, 0),
        rejectedQuantity: receiptLines.reduce((sum, line) => sum + line.rejectedQuantity, 0),
        missingQuantity: receiptLines.reduce((sum, line) => sum + line.missingQuantity, 0),
      });
    });
    await this.audit(tenant, AuditAction.UPDATE, 'DispatchNote', id, { status, outcome });
    return this.getDispatch(tenant, id);
  }

  async cancelDispatchNote(tenant: TenantContext, id: string) {
    const existing = await this.getDispatch(tenant, id);
    if (existing.status === DispatchNoteStatus.CANCELLED) {
      throw new BadRequestException('Dispatch note is already cancelled.');
    }

    const cancelledAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const terminalStatuses: DispatchNoteStatus[] = [
        DispatchNoteStatus.COMPLETED,
        DispatchNoteStatus.PARTIALLY_RECEIVED,
        DispatchNoteStatus.REJECTED,
      ];
      if (terminalStatuses.includes(existing.status) && existing.deliveryWarehouseId) {
        for (const line of existing.lines) {
          if (!line.item.trackInventory) continue;
          const acceptedQuantity = Number(
            existing.deliveryReceipt?.lines.find(
              (receiptLine) => receiptLine.dispatchNoteLineId === line.id,
            )?.acceptedQuantity ?? 0,
          );
          if (acceptedQuantity === 0) continue;
          await this.decreaseStock(
            tx,
            existing.deliveryWarehouseId,
            line.itemId,
            acceptedQuantity,
          );
          await this.createMovement(
            tx,
            existing,
            line,
            existing.deliveryWarehouseId,
            StockMovementKind.CANCEL_IN_REVERSAL,
            acceptedQuantity,
            cancelledAt,
          );
        }
      }

      if (
        existing.status === DispatchNoteStatus.ISSUED ||
        terminalStatuses.includes(existing.status)
      ) {
        for (const line of existing.lines) {
          if (!line.item.trackInventory) continue;
          await this.increaseStock(
            tx,
            existing.loadingWarehouseId,
            line.itemId,
            Number(line.quantity),
          );
          await this.createMovement(
            tx,
            existing,
            line,
            existing.loadingWarehouseId,
            StockMovementKind.CANCEL_OUT_REVERSAL,
            Number(line.quantity),
            cancelledAt,
          );
        }
      }

      await tx.dispatchNote.update({
        where: { id: existing.id },
        data: { status: DispatchNoteStatus.CANCELLED, cancelledAt },
      });
      await this.createLifecycleEvent(tx, existing, DispatchEventType.CANCELLED, cancelledAt, {
        previousStatus: existing.status,
      });
    });
    await this.audit(tenant, AuditAction.UPDATE, 'DispatchNote', id, { status: 'CANCELLED' });
    return this.getDispatch(tenant, id);
  }

  findStock(tenant: TenantContext, query: CompanyScopedQueryDto = {}) {
    return this.prisma.warehouseStock.findMany({
      where: {
        warehouse: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId: query.clientCompanyId,
          deletedAt: null,
        },
      },
      include: {
        warehouse: true,
        item: true,
      },
      orderBy: [{ warehouse: { code: 'asc' } }, { item: { code: 'asc' } }],
    });
  }

  async findStockMovements(tenant: TenantContext, query: FindStockMovementsQueryDto = {}) {
    const movements = await this.prisma.stockMovement.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: query.clientCompanyId,
        warehouseId: query.warehouseId,
        itemId: query.itemId,
        occurredAt:
          query.dateFrom || query.dateTo
            ? {
                gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
                lte: query.dateTo ? new Date(query.dateTo) : undefined,
              }
            : undefined,
      },
      include: {
        warehouse: true,
        item: true,
        dispatchNote: { select: { id: true, series: true, number: true, status: true } },
      },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });

    return movements.map((movement) => ({
      ...movement,
      signedQuantity: this.signedMovementQuantity(movement.kind, Number(movement.quantity)),
    }));
  }

  async adjustStock(tenant: TenantContext, dto: AdjustStockDto) {
    const warehouse = await this.getWarehouse(tenant, dto.warehouseId);
    const item = await this.getItem(tenant, dto.itemId);
    if (warehouse.clientCompanyId !== item.clientCompanyId) {
      throw new BadRequestException('Warehouse and item must belong to the same client company.');
    }
    if (!item.trackInventory) {
      throw new BadRequestException('This item is not configured for inventory tracking.');
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.quantity < 0) {
        await this.decreaseStock(tx, warehouse.id, item.id, Math.abs(dto.quantity));
      } else {
        await this.increaseStock(tx, warehouse.id, item.id, dto.quantity);
      }
      await tx.stockMovement.create({
        data: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId: item.clientCompanyId,
          warehouseId: warehouse.id,
          itemId: item.id,
          kind: StockMovementKind.ADJUSTMENT,
          quantity: dto.quantity,
          occurredAt: new Date(),
        },
      });
    });
    await this.audit(tenant, AuditAction.UPDATE, 'WarehouseStock', `${warehouse.id}:${item.id}`, {
      quantity: dto.quantity,
      reason: dto.reason ?? null,
    });
    return this.prisma.warehouseStock.findUniqueOrThrow({
      where: { warehouseId_itemId: { warehouseId: warehouse.id, itemId: item.id } },
      include: { warehouse: true, item: true },
    });
  }

  private resolveReceiptLines(
    lines: Array<{ id: string; quantity: Prisma.Decimal }>,
    dto: CompleteDispatchNoteDto,
  ) {
    if (!dto.lines) {
      return lines.map((line) => ({
        dispatchNoteLineId: line.id,
        orderedQuantity: Number(line.quantity),
        acceptedQuantity: Number(line.quantity),
        rejectedQuantity: 0,
        missingQuantity: 0,
      }));
    }

    const supplied = new Map(dto.lines.map((line) => [line.dispatchNoteLineId, line]));
    if (supplied.size !== dto.lines.length) {
      throw new BadRequestException('Each dispatch line can appear only once in a delivery receipt.');
    }
    if (supplied.size !== lines.length || lines.some((line) => !supplied.has(line.id))) {
      throw new BadRequestException('A delivery receipt must include every dispatch line exactly once.');
    }

    return lines.map((line) => {
      const receiptLine = supplied.get(line.id)!;
      const orderedQuantity = this.roundQuantity(Number(line.quantity));
      const acceptedQuantity = this.roundQuantity(receiptLine.acceptedQuantity);
      const rejectedQuantity = this.roundQuantity(receiptLine.rejectedQuantity ?? 0);
      if (acceptedQuantity + rejectedQuantity > orderedQuantity + 0.0001) {
        throw new BadRequestException(
          'Accepted and rejected quantities cannot exceed the dispatched quantity.',
        );
      }
      return {
        dispatchNoteLineId: line.id,
        orderedQuantity,
        acceptedQuantity,
        rejectedQuantity,
        missingQuantity: this.roundQuantity(
          orderedQuantity - acceptedQuantity - rejectedQuantity,
        ),
        qualityNotes: receiptLine.qualityNotes?.trim() || undefined,
      };
    });
  }

  private deliveryOutcome(
    lines: Array<{
      orderedQuantity: number;
      acceptedQuantity: number;
      rejectedQuantity: number;
      missingQuantity: number;
    }>,
  ): DeliveryOutcome {
    if (lines.every((line) => line.acceptedQuantity === line.orderedQuantity)) {
      return DeliveryOutcome.FULL;
    }
    if (lines.every((line) => line.acceptedQuantity === 0)) {
      return DeliveryOutcome.NONE;
    }
    return DeliveryOutcome.PARTIAL;
  }

  private deliveryStatus(outcome: DeliveryOutcome): DispatchNoteStatus {
    if (outcome === DeliveryOutcome.FULL) return DispatchNoteStatus.COMPLETED;
    if (outcome === DeliveryOutcome.PARTIAL) return DispatchNoteStatus.PARTIALLY_RECEIVED;
    return DispatchNoteStatus.REJECTED;
  }

  private deliveryEventType(outcome: DeliveryOutcome): DispatchEventType {
    if (outcome === DeliveryOutcome.FULL) return DispatchEventType.DELIVERY_COMPLETED;
    if (outcome === DeliveryOutcome.PARTIAL) return DispatchEventType.DELIVERY_PARTIAL;
    return DispatchEventType.DELIVERY_REJECTED;
  }

  private createLifecycleEvent(
    tx: Prisma.TransactionClient,
    note: { id: string; accountingOfficeId: string; clientCompanyId: string },
    eventType: DispatchEventType,
    eventAt: Date,
    details?: Record<string, unknown>,
  ) {
    return tx.dispatchLifecycleEvent.create({
      data: {
        accountingOfficeId: note.accountingOfficeId,
        clientCompanyId: note.clientCompanyId,
        dispatchNoteId: note.id,
        eventType,
        eventAt,
        details: details
          ? (JSON.parse(JSON.stringify(details)) as Prisma.InputJsonValue)
          : undefined,
      },
    });
  }

  private signedMovementQuantity(kind: StockMovementKind, quantity: number) {
    if (kind === StockMovementKind.ADJUSTMENT) return quantity;
    if (
      kind === StockMovementKind.DISPATCH_OUT ||
      kind === StockMovementKind.CANCEL_IN_REVERSAL
    ) {
      return -Math.abs(quantity);
    }
    return Math.abs(quantity);
  }

  private roundQuantity(quantity: number) {
    return Math.round((quantity + Number.EPSILON) * 1000) / 1000;
  }

  private async resolveDispatchReferences(
    tenant: TenantContext,
    clientCompanyId: string,
    dto: {
      counterpartyId?: string;
      loadingWarehouseId: string;
      deliveryWarehouseId?: string;
      vehicleId?: string;
      lines: CreateDispatchNoteLineDto[];
    },
  ) {
    await this.ensureCompany(tenant, clientCompanyId);
    this.validateMovePurpose(dto.lines);
    if (dto.deliveryWarehouseId && dto.deliveryWarehouseId === dto.loadingWarehouseId) {
      throw new BadRequestException('Loading and delivery warehouse must be different.');
    }
    const duplicateItem = dto.lines.find(
      (line, index) =>
        dto.lines.findIndex((candidate) => candidate.itemId === line.itemId) !== index,
    );
    if (duplicateItem) {
      throw new BadRequestException('Each item can appear only once per dispatch note.');
    }

    const [loadingWarehouse, deliveryWarehouse, vehicle, counterparty, items] = await Promise.all([
      this.prisma.warehouse.findFirst({
        where: {
          id: dto.loadingWarehouseId,
          clientCompanyId,
          accountingOfficeId: tenant.accountingOfficeId,
          isActive: true,
          deletedAt: null,
        },
      }),
      dto.deliveryWarehouseId
        ? this.prisma.warehouse.findFirst({
            where: {
              id: dto.deliveryWarehouseId,
              clientCompanyId,
              accountingOfficeId: tenant.accountingOfficeId,
              isActive: true,
              deletedAt: null,
            },
          })
        : null,
      dto.vehicleId
        ? this.prisma.vehicle.findFirst({
            where: {
              id: dto.vehicleId,
              clientCompanyId,
              accountingOfficeId: tenant.accountingOfficeId,
              isActive: true,
              deletedAt: null,
            },
          })
        : null,
      dto.counterpartyId
        ? this.prisma.counterparty.findFirst({
            where: {
              id: dto.counterpartyId,
              clientCompanyId,
              accountingOfficeId: tenant.accountingOfficeId,
              deletedAt: null,
            },
          })
        : null,
      this.prisma.inventoryItem.findMany({
        where: {
          id: { in: dto.lines.map((line) => line.itemId) },
          clientCompanyId,
          accountingOfficeId: tenant.accountingOfficeId,
          isActive: true,
          deletedAt: null,
        },
      }),
    ]);

    if (!loadingWarehouse) throw new NotFoundException('Loading warehouse was not found.');
    if (dto.deliveryWarehouseId && !deliveryWarehouse) {
      throw new NotFoundException('Delivery warehouse was not found.');
    }
    if (dto.vehicleId && !vehicle) throw new NotFoundException('Vehicle was not found.');
    if (dto.counterpartyId && !counterparty) {
      throw new NotFoundException('Counterparty was not found.');
    }
    if (items.length !== dto.lines.length) {
      throw new NotFoundException('One or more inventory items were not found.');
    }

    return {
      loadingWarehouse,
      deliveryWarehouse,
      vehicle,
      counterparty,
      items: new Map(items.map((item) => [item.id, item])),
    };
  }

  private validateMovePurpose(lines: CreateDispatchNoteLineDto[]) {
    const disabledPurposes = new Set([6, 15, 16, 17, 18]);
    for (const line of lines) {
      if (line.movePurposeLine && disabledPurposes.has(line.movePurposeLine)) {
        throw new BadRequestException(
          `AADE move purpose ${line.movePurposeLine} is not accepted by the current specification.`,
        );
      }
      if (line.movePurposeLine === 19 && !line.otherMovePurposeLineTitle?.trim()) {
        throw new BadRequestException('Other movement purpose title is required for purpose 19.');
      }
      if (line.movePurposeLine !== 19 && line.otherMovePurposeLineTitle) {
        throw new BadRequestException('Other movement purpose title is only valid for purpose 19.');
      }
    }
  }

  private validateHeaderMovePurpose(movePurpose: number, otherTitle?: string) {
    if ([6, 15, 16, 17, 18].includes(movePurpose)) {
      throw new BadRequestException(
        `AADE move purpose ${movePurpose} is not accepted by the current specification.`,
      );
    }
    if (movePurpose === 19 && !otherTitle?.trim()) {
      throw new BadRequestException('Other movement purpose title is required for purpose 19.');
    }
    if (movePurpose !== 19 && otherTitle) {
      throw new BadRequestException('Other movement purpose title is only valid for purpose 19.');
    }
  }

  private assertMovementAddresses(loadingAddress: string, deliveryAddress: string) {
    if (!loadingAddress.trim() || !deliveryAddress.trim()) {
      throw new BadRequestException('Loading and delivery addresses are required.');
    }
  }

  private snapshotLines(
    lines: CreateDispatchNoteLineDto[],
    items: Map<string, { id: string; code: string; name: string; measurementUnit: number }>,
  ) {
    return lines.map((line, index) => {
      const item = items.get(line.itemId);
      if (!item) throw new NotFoundException('Inventory item was not found.');
      return {
        itemId: item.id,
        lineNumber: index + 1,
        itemCode: item.code,
        description: item.name,
        quantity: line.quantity,
        measurementUnit: item.measurementUnit,
        movePurposeLine: line.movePurposeLine,
        otherMovePurposeLineTitle: line.otherMovePurposeLineTitle,
      };
    });
  }

  private async decreaseStock(
    tx: Prisma.TransactionClient,
    warehouseId: string,
    itemId: string,
    quantity: number,
  ) {
    const result = await tx.warehouseStock.updateMany({
      where: { warehouseId, itemId, quantity: { gte: quantity } },
      data: { quantity: { decrement: quantity } },
    });
    if (result.count !== 1) {
      throw new BadRequestException('Insufficient available stock for one or more items.');
    }
  }

  private increaseStock(
    tx: Prisma.TransactionClient,
    warehouseId: string,
    itemId: string,
    quantity: number,
  ) {
    return tx.warehouseStock.upsert({
      where: { warehouseId_itemId: { warehouseId, itemId } },
      create: { warehouseId, itemId, quantity },
      update: { quantity: { increment: quantity } },
    });
  }

  private createMovement(
    tx: Prisma.TransactionClient,
    note: { id: string; accountingOfficeId: string; clientCompanyId: string },
    line: { id: string; itemId: string },
    warehouseId: string,
    kind: StockMovementKind,
    quantity: number,
    occurredAt: Date,
  ) {
    return tx.stockMovement.create({
      data: {
        accountingOfficeId: note.accountingOfficeId,
        clientCompanyId: note.clientCompanyId,
        warehouseId,
        itemId: line.itemId,
        dispatchNoteId: note.id,
        dispatchNoteLineId: line.id,
        kind,
        quantity,
        occurredAt,
      },
    });
  }

  private async ensureCompany(tenant: TenantContext, id: string) {
    const company = await this.prisma.clientCompany.findFirst({
      where: { id, accountingOfficeId: tenant.accountingOfficeId, deletedAt: null },
      select: { id: true },
    });
    if (!company) throw new NotFoundException('Client company was not found.');
  }

  private async getItem(tenant: TenantContext, id: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id, accountingOfficeId: tenant.accountingOfficeId, deletedAt: null },
    });
    if (!item) throw new NotFoundException('Inventory item was not found.');
    return item;
  }

  private async getWarehouse(tenant: TenantContext, id: string) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id, accountingOfficeId: tenant.accountingOfficeId, deletedAt: null },
    });
    if (!warehouse) throw new NotFoundException('Warehouse was not found.');
    return warehouse;
  }

  private async getVehicle(tenant: TenantContext, id: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, accountingOfficeId: tenant.accountingOfficeId, deletedAt: null },
    });
    if (!vehicle) throw new NotFoundException('Vehicle was not found.');
    return vehicle;
  }

  private async getDispatch(tenant: TenantContext, id: string) {
    const note = await this.prisma.dispatchNote.findFirst({
      where: { id, accountingOfficeId: tenant.accountingOfficeId },
      include: dispatchInclude,
    });
    if (!note) throw new NotFoundException('Dispatch note was not found.');
    return note;
  }

  private noteAudit(note: {
    series: string;
    number: string;
    status: DispatchNoteStatus;
    movePurpose: number;
    lines: Array<{ itemCode: string; quantity: Prisma.Decimal }>;
  }): Prisma.InputJsonValue {
    return {
      series: note.series,
      number: note.number,
      status: note.status,
      movePurpose: note.movePurpose,
      lines: note.lines.map((line) => ({
        itemCode: line.itemCode,
        quantity: Number(line.quantity),
      })),
    };
  }

  private audit(
    tenant: TenantContext,
    action: AuditAction,
    entityType: string,
    entityId: string,
    value: unknown,
  ) {
    return this.auditService.record({
      tenant,
      action,
      entityType,
      entityId,
      newValue: JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue,
    });
  }
}
