import { BadRequestException } from '@nestjs/common';
import { DispatchNoteStatus, Prisma, StockMovementKind } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { DigitalMovementService } from './digital-movement.service';

const tenant: TenantContext = { accountingOfficeId: 'office-1', userId: 'user-1' };

function dispatchNote(status: DispatchNoteStatus, deliveryWarehouseId: string | null = null) {
  return {
    id: 'dispatch-1',
    accountingOfficeId: 'office-1',
    clientCompanyId: 'company-1',
    series: 'ΔΑ',
    number: '1',
    issueDate: new Date(),
    plannedDispatchAt: new Date(),
    status,
    movePurpose: 1,
    otherMovePurposeTitle: null,
    counterpartyId: null,
    recipientName: 'Recipient',
    recipientVatNumber: null,
    loadingWarehouseId: 'warehouse-out',
    deliveryWarehouseId,
    vehicleId: null,
    vehicleNumber: null,
    loadingAddress: 'A',
    deliveryAddress: 'B',
    notes: null,
    issuedAt: status === DispatchNoteStatus.DRAFT ? null : new Date(),
    completedAt: status === DispatchNoteStatus.COMPLETED ? new Date() : null,
    cancelledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    clientCompany: { id: 'company-1', legalName: 'Demo', vatNumber: '123456789' },
    counterparty: null,
    loadingWarehouse: { id: 'warehouse-out' },
    deliveryWarehouse: null,
    vehicle: null,
    deliveryReceipt: null,
    lifecycleEvents: [],
    lines: [
      {
        id: 'line-1',
        dispatchNoteId: 'dispatch-1',
        itemId: 'item-1',
        lineNumber: 1,
        itemCode: 'ITEM-1',
        description: 'Item',
        quantity: new Prisma.Decimal(5),
        measurementUnit: 1,
        movePurposeLine: null,
        otherMovePurposeLineTitle: null,
        createdAt: new Date(),
        item: { id: 'item-1', trackInventory: true },
      },
    ],
  };
}

describe('DigitalMovementService', () => {
  it('rejects AADE-disabled movement purposes before persistence', async () => {
    const service = new DigitalMovementService(
      {} as PrismaService,
      { record: jest.fn() } as unknown as AuditService,
    );
    await expect(
      service.createDispatchNote(tenant, {
        clientCompanyId: 'company-1',
        series: 'ΔΑ',
        number: '1',
        issueDate: '2026-07-18',
        plannedDispatchAt: '2026-07-18T10:00:00Z',
        movePurpose: 6,
        loadingWarehouseId: 'warehouse-1',
        deliveryAddress: 'B',
        lines: [{ itemId: 'item-1', quantity: 1 }],
      }),
    ).rejects.toThrow('not accepted');
  });

  it('requires a title for AADE purpose 19', async () => {
    const service = new DigitalMovementService(
      {} as PrismaService,
      { record: jest.fn() } as unknown as AuditService,
    );
    await expect(
      service.createDispatchNote(tenant, {
        clientCompanyId: 'company-1',
        series: 'ΔΑ',
        number: '1',
        issueDate: '2026-07-18',
        plannedDispatchAt: '2026-07-18T10:00:00Z',
        movePurpose: 19,
        loadingWarehouseId: 'warehouse-1',
        deliveryAddress: 'B',
        lines: [{ itemId: 'item-1', quantity: 1 }],
      }),
    ).rejects.toThrow('title is required');
  });

  it('issues a draft by atomically reducing stock and recording the movement', async () => {
    const note = dispatchNote(DispatchNoteStatus.DRAFT);
    const tx = {
      warehouseStock: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      stockMovement: { create: jest.fn().mockResolvedValue({ id: 'movement-1' }) },
      dispatchNote: { update: jest.fn().mockResolvedValue(note) },
      dispatchLifecycleEvent: { create: jest.fn().mockResolvedValue({ id: 'event-1' }) },
    };
    const prisma = {
      dispatchNote: { findFirst: jest.fn().mockResolvedValue(note) },
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const audit = { record: jest.fn() };
    const service = new DigitalMovementService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );

    await service.issueDispatchNote(tenant, 'dispatch-1');

    expect(tx.warehouseStock.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          warehouseId: 'warehouse-out',
          itemId: 'item-1',
          quantity: { gte: 5 },
        }),
        data: { quantity: { decrement: 5 } },
      }),
    );
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: StockMovementKind.DISPATCH_OUT, quantity: 5 }),
    });
    expect(tx.dispatchNote.update).toHaveBeenCalledWith({
      where: { id: 'dispatch-1' },
      data: expect.objectContaining({ status: DispatchNoteStatus.ISSUED }),
    });
  });

  it('rolls back issuance when available stock is insufficient', async () => {
    const note = dispatchNote(DispatchNoteStatus.DRAFT);
    const tx = {
      warehouseStock: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      stockMovement: { create: jest.fn() },
      dispatchNote: { update: jest.fn() },
      dispatchLifecycleEvent: { create: jest.fn() },
    };
    const prisma = {
      dispatchNote: { findFirst: jest.fn().mockResolvedValue(note) },
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new DigitalMovementService(
      prisma as unknown as PrismaService,
      { record: jest.fn() } as unknown as AuditService,
    );

    await expect(service.issueDispatchNote(tenant, 'dispatch-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
    expect(tx.dispatchNote.update).not.toHaveBeenCalled();
  });

  it('completes an internal transfer by adding stock to the destination warehouse', async () => {
    const note = dispatchNote(DispatchNoteStatus.ISSUED, 'warehouse-in');
    const tx = {
      warehouseStock: { upsert: jest.fn().mockResolvedValue({ id: 'stock-1' }) },
      stockMovement: { create: jest.fn().mockResolvedValue({ id: 'movement-1' }) },
      dispatchNote: { update: jest.fn().mockResolvedValue(note) },
      dispatchDeliveryReceipt: { create: jest.fn().mockResolvedValue({ id: 'receipt-1' }) },
      dispatchLifecycleEvent: { create: jest.fn().mockResolvedValue({ id: 'event-1' }) },
    };
    const prisma = {
      dispatchNote: { findFirst: jest.fn().mockResolvedValue(note) },
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new DigitalMovementService(
      prisma as unknown as PrismaService,
      { record: jest.fn() } as unknown as AuditService,
    );

    await service.completeDispatchNote(tenant, 'dispatch-1');

    expect(tx.warehouseStock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { warehouseId_itemId: { warehouseId: 'warehouse-in', itemId: 'item-1' } },
        update: { quantity: { increment: 5 } },
      }),
    );
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: StockMovementKind.DELIVERY_IN,
        warehouseId: 'warehouse-in',
      }),
    });
    expect(tx.dispatchDeliveryReceipt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        outcome: 'FULL',
        lines: {
          create: [
            expect.objectContaining({ acceptedQuantity: 5, rejectedQuantity: 0, missingQuantity: 0 }),
          ],
        },
      }),
    });
  });

  it('records partial delivery quantities and moves only accepted destination stock', async () => {
    const note = dispatchNote(DispatchNoteStatus.ISSUED, 'warehouse-in');
    const tx = {
      warehouseStock: { upsert: jest.fn().mockResolvedValue({ id: 'stock-1' }) },
      stockMovement: { create: jest.fn().mockResolvedValue({ id: 'movement-1' }) },
      dispatchNote: { update: jest.fn().mockResolvedValue(note) },
      dispatchDeliveryReceipt: { create: jest.fn().mockResolvedValue({ id: 'receipt-1' }) },
      dispatchLifecycleEvent: { create: jest.fn().mockResolvedValue({ id: 'event-1' }) },
    };
    const prisma = {
      dispatchNote: { findFirst: jest.fn().mockResolvedValue(note) },
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new DigitalMovementService(
      prisma as unknown as PrismaService,
      { record: jest.fn() } as unknown as AuditService,
    );

    await service.completeDispatchNote(tenant, 'dispatch-1', {
      lines: [
        {
          dispatchNoteLineId: 'line-1',
          acceptedQuantity: 3,
          rejectedQuantity: 1,
          qualityNotes: 'Damaged package',
        },
      ],
    });

    expect(tx.warehouseStock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { quantity: { increment: 3 } } }),
    );
    expect(tx.dispatchDeliveryReceipt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        outcome: 'PARTIAL',
        lines: {
          create: [
            expect.objectContaining({
              acceptedQuantity: 3,
              rejectedQuantity: 1,
              missingQuantity: 1,
            }),
          ],
        },
      }),
    });
    expect(tx.dispatchNote.update).toHaveBeenCalledWith({
      where: { id: 'dispatch-1' },
      data: expect.objectContaining({ status: DispatchNoteStatus.PARTIALLY_RECEIVED }),
    });
  });

  it('returns stock ledger quantities with their inventory direction', async () => {
    const prisma = {
      stockMovement: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'out', kind: StockMovementKind.DISPATCH_OUT, quantity: new Prisma.Decimal(5) },
          { id: 'in', kind: StockMovementKind.DELIVERY_IN, quantity: new Prisma.Decimal(3) },
          { id: 'adjust', kind: StockMovementKind.ADJUSTMENT, quantity: new Prisma.Decimal(-2) },
        ]),
      },
    };
    const service = new DigitalMovementService(
      prisma as unknown as PrismaService,
      { record: jest.fn() } as unknown as AuditService,
    );

    const result = await service.findStockMovements(tenant, { clientCompanyId: 'company-1' });

    expect(result.map((movement) => movement.signedQuantity)).toEqual([-5, 3, -2]);
  });
});
