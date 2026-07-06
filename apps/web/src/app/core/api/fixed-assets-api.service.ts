import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface FixedAssetDepreciationEntry {
  id: string;
  fixedAssetId: string;
  fiscalYear: number;
  amount: string | number;
  accumulatedAmount: string | number;
  bookValueAfter: string | number;
  posted: boolean;
  createdAt: string;
}

export interface FixedAsset {
  id: string;
  clientCompanyId: string;
  code: string;
  description: string;
  category: string;
  acquisitionDate: string;
  depreciationStartDate: string;
  acquisitionDocumentNumber?: string | null;
  supplierName?: string | null;
  netValue: string | number;
  vatAmount: string | number;
  totalValue: string | number;
  depreciationRate: string | number;
  accumulatedDepreciation: string | number;
  status: string;
  disposalDate?: string | null;
  notes?: string | null;
  clientCompany?: {
    id: string;
    legalName: string;
    vatNumber: string;
  };
  depreciationEntries?: FixedAssetDepreciationEntry[];
}

export interface FixedAssetPayload {
  clientCompanyId: string;
  code: string;
  description: string;
  category?: string;
  acquisitionDate: string;
  depreciationStartDate?: string;
  acquisitionDocumentNumber?: string;
  supplierName?: string;
  netValue: number;
  vatAmount: number;
  totalValue: number;
  depreciationRate: number;
  notes?: string;
}

export interface FixedAssetFilters {
  clientCompanyId?: string;
  category?: string;
  status?: string;
}

@Injectable({
  providedIn: 'root',
})
export class FixedAssetsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/fixed-assets`;

  findAll(filters: FixedAssetFilters = {}): Observable<FixedAsset[]> {
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''),
    );

    return this.http.get<FixedAsset[]>(this.baseUrl, { headers: this.headers, params });
  }

  create(payload: FixedAssetPayload): Observable<FixedAsset> {
    return this.http.post<FixedAsset>(this.baseUrl, payload, { headers: this.headers });
  }

  update(id: string, payload: FixedAssetPayload): Observable<FixedAsset> {
    return this.http.patch<FixedAsset>(`${this.baseUrl}/${id}`, payload, { headers: this.headers });
  }

  generateDepreciation(assetId: string, year: number): Observable<FixedAssetDepreciationEntry> {
    return this.http.post<FixedAssetDepreciationEntry>(
      `${this.baseUrl}/${assetId}/depreciation/${year}`,
      {},
      { headers: this.headers },
    );
  }

  private get headers(): HttpHeaders {
    return new HttpHeaders({
      'x-office-id': 'office-athens-demo',
    });
  }
}
