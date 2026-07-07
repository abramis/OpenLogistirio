import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Counterparty {
  id: string;
  clientCompanyId: string;
  type: string;
  name: string;
  vatNumber?: string | null;
  country: string;
  taxOffice?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  clientCompany?: {
    id: string;
    legalName: string;
    vatNumber: string;
  };
}

export interface CounterpartyPayload {
  clientCompanyId: string;
  type: string;
  name: string;
  vatNumber?: string;
  country?: string;
  taxOffice?: string;
  address?: string;
  email?: string;
  phone?: string;
  notes?: string;
}

export interface CounterpartyFilters {
  clientCompanyId?: string;
  type?: string;
  search?: string;
}

@Injectable({ providedIn: 'root' })
export class CounterpartiesApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/counterparties`;

  findAll(filters: CounterpartyFilters = {}): Observable<Counterparty[]> {
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''),
    );

    return this.http.get<Counterparty[]>(this.baseUrl, { params });
  }

  create(payload: CounterpartyPayload): Observable<Counterparty> {
    return this.http.post<Counterparty>(this.baseUrl, payload, {});
  }

  update(id: string, payload: CounterpartyPayload): Observable<Counterparty> {
    return this.http.patch<Counterparty>(`${this.baseUrl}/${id}`, payload, {});
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`, {});
  }
}
