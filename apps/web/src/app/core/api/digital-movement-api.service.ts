import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface InventoryItem {
  id: string;
  clientCompanyId: string;
  code: string;
  name: string;
  description?: string | null;
  measurementUnit: number;
  trackInventory: boolean;
  isActive: boolean;
  clientCompany?: { id: string; legalName: string };
}

export interface Warehouse {
  id: string;
  clientCompanyId: string;
  code: string;
  name: string;
  address?: string | null;
  branchNumber?: number | null;
  isActive: boolean;
  clientCompany?: { id: string; legalName: string };
}

export interface Vehicle {
  id: string;
  clientCompanyId: string;
  registrationNumber: string;
  description?: string | null;
  vehicleType?: string | null;
  isActive: boolean;
  clientCompany?: { id: string; legalName: string };
}

export interface DispatchNoteLine {
  id: string;
  itemId: string;
  itemCode: string;
  description: string;
  quantity: number;
  measurementUnit: number;
}

export interface DispatchDeliveryReceiptLine {
  id: string;
  dispatchNoteLineId: string;
  orderedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  missingQuantity: number;
  qualityNotes?: string | null;
}

export interface DispatchDeliveryReceipt {
  id: string;
  outcome: 'FULL' | 'PARTIAL' | 'NONE';
  deliveredWithoutRecipient: boolean;
  receivedAt: string;
  notes?: string | null;
  lines: DispatchDeliveryReceiptLine[];
}

export interface DispatchLifecycleEvent {
  id: string;
  eventType:
    | 'CREATED'
    | 'UPDATED'
    | 'ISSUED'
    | 'DELIVERY_COMPLETED'
    | 'DELIVERY_PARTIAL'
    | 'DELIVERY_REJECTED'
    | 'CANCELLED';
  eventAt: string;
  details?: Record<string, unknown> | null;
}

export interface DispatchNote {
  id: string;
  clientCompanyId: string;
  series: string;
  number: string;
  issueDate: string;
  plannedDispatchAt: string;
  status:
    | 'DRAFT'
    | 'ISSUED'
    | 'COMPLETED'
    | 'PARTIALLY_RECEIVED'
    | 'REJECTED'
    | 'CANCELLED';
  movePurpose: number;
  otherMovePurposeTitle?: string | null;
  recipientName?: string | null;
  recipientVatNumber?: string | null;
  loadingWarehouseId: string;
  deliveryWarehouseId?: string | null;
  vehicleId?: string | null;
  vehicleNumber?: string | null;
  loadingAddress: string;
  deliveryAddress: string;
  notes?: string | null;
  clientCompany: { id: string; legalName: string; vatNumber: string };
  loadingWarehouse: Warehouse;
  deliveryWarehouse?: Warehouse | null;
  vehicle?: Vehicle | null;
  lines: DispatchNoteLine[];
  deliveryReceipt?: DispatchDeliveryReceipt | null;
  lifecycleEvents: DispatchLifecycleEvent[];
}

export interface WarehouseStock {
  id: string;
  quantity: number;
  warehouse: Warehouse;
  item: InventoryItem;
}

export interface StockMovement {
  id: string;
  kind:
    | 'ADJUSTMENT'
    | 'DISPATCH_OUT'
    | 'DELIVERY_IN'
    | 'CANCEL_OUT_REVERSAL'
    | 'CANCEL_IN_REVERSAL';
  quantity: number;
  signedQuantity: number;
  occurredAt: string;
  warehouse: Warehouse;
  item: InventoryItem;
  dispatchNote?: Pick<DispatchNote, 'id' | 'series' | 'number' | 'status'> | null;
}

export interface CompleteDeliveryPayload {
  receivedAt?: string;
  deliveredWithoutRecipient?: boolean;
  notes?: string;
  lines?: Array<{
    dispatchNoteLineId: string;
    acceptedQuantity: number;
    rejectedQuantity?: number;
    qualityNotes?: string;
  }>;
}

export interface DispatchNotePayload {
  clientCompanyId: string;
  series: string;
  number: string;
  issueDate: string;
  plannedDispatchAt: string;
  movePurpose: number;
  otherMovePurposeTitle?: string;
  recipientName?: string;
  recipientVatNumber?: string;
  loadingWarehouseId: string;
  deliveryWarehouseId?: string;
  vehicleId?: string;
  vehicleNumber?: string;
  loadingAddress?: string;
  deliveryAddress: string;
  notes?: string;
  lines: Array<{ itemId: string; quantity: number; movePurposeLine?: number }>;
}

@Injectable({ providedIn: 'root' })
export class DigitalMovementApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/digital-movement`;

  findItems(clientCompanyId = ''): Observable<InventoryItem[]> {
    return this.http.get<InventoryItem[]>(`${this.baseUrl}/items`, {
      params: clientCompanyId ? { clientCompanyId } : {},
    });
  }

  createItem(payload: Omit<InventoryItem, 'id' | 'isActive'>): Observable<InventoryItem> {
    return this.http.post<InventoryItem>(`${this.baseUrl}/items`, payload);
  }

  findWarehouses(clientCompanyId = ''): Observable<Warehouse[]> {
    return this.http.get<Warehouse[]>(`${this.baseUrl}/warehouses`, {
      params: clientCompanyId ? { clientCompanyId } : {},
    });
  }

  createWarehouse(
    payload: Partial<Warehouse> & { clientCompanyId: string; code: string; name: string },
  ) {
    return this.http.post<Warehouse>(`${this.baseUrl}/warehouses`, payload);
  }

  findVehicles(clientCompanyId = ''): Observable<Vehicle[]> {
    return this.http.get<Vehicle[]>(`${this.baseUrl}/vehicles`, {
      params: clientCompanyId ? { clientCompanyId } : {},
    });
  }

  createVehicle(
    payload: Partial<Vehicle> & { clientCompanyId: string; registrationNumber: string },
  ) {
    return this.http.post<Vehicle>(`${this.baseUrl}/vehicles`, payload);
  }

  findDispatchNotes(clientCompanyId = '', status = ''): Observable<DispatchNote[]> {
    return this.http.get<DispatchNote[]>(`${this.baseUrl}/dispatch-notes`, {
      params: {
        ...(clientCompanyId ? { clientCompanyId } : {}),
        ...(status ? { status } : {}),
      },
    });
  }

  createDispatchNote(payload: DispatchNotePayload): Observable<DispatchNote> {
    return this.http.post<DispatchNote>(`${this.baseUrl}/dispatch-notes`, payload);
  }

  issue(id: string): Observable<DispatchNote> {
    return this.http.post<DispatchNote>(`${this.baseUrl}/dispatch-notes/${id}/issue`, {});
  }

  complete(id: string, payload: CompleteDeliveryPayload = {}): Observable<DispatchNote> {
    return this.http.post<DispatchNote>(
      `${this.baseUrl}/dispatch-notes/${id}/complete`,
      payload,
    );
  }

  cancel(id: string): Observable<DispatchNote> {
    return this.http.post<DispatchNote>(`${this.baseUrl}/dispatch-notes/${id}/cancel`, {});
  }

  findStock(clientCompanyId = ''): Observable<WarehouseStock[]> {
    return this.http.get<WarehouseStock[]>(`${this.baseUrl}/stock`, {
      params: clientCompanyId ? { clientCompanyId } : {},
    });
  }

  findStockMovements(clientCompanyId = ''): Observable<StockMovement[]> {
    return this.http.get<StockMovement[]>(`${this.baseUrl}/stock/movements`, {
      params: clientCompanyId ? { clientCompanyId } : {},
    });
  }

  adjustStock(payload: { warehouseId: string; itemId: string; quantity: number; reason?: string }) {
    return this.http.post<WarehouseStock>(`${this.baseUrl}/stock/adjust`, payload);
  }
}
