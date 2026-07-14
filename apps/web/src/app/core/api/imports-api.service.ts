import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ImportBatch {
  id: string;
  clientCompanyId: string;
  type: string;
  status: string;
  fileName?: string | null;
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  createdAt: string;
  errorReport?: unknown;
  clientCompany?: {
    legalName: string;
    vatNumber: string;
  };
}

export interface DocumentsCsvImportResponse {
  batch: ImportBatch;
  dryRun: boolean;
  totalRows: number;
  validRows: number;
  failedRows: number;
  errors: Array<{ rowNumber: number; field?: string; code: string; message: string }>;
  preview: Array<Record<string, unknown>>;
}

@Injectable({ providedIn: 'root' })
export class ImportsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/imports`;

  history(): Observable<ImportBatch[]> {
    return this.http.get<ImportBatch[]>(this.baseUrl, {});
  }

  importDocumentsCsv(payload: {
    clientCompanyId: string;
    csvText: string;
    fileName?: string;
    dryRun?: boolean;
  }): Observable<DocumentsCsvImportResponse> {
    return this.http.post<DocumentsCsvImportResponse>(`${this.baseUrl}/documents-csv`, payload, {});
  }

  errorReportCsv(id: string): Observable<string> {
    return this.http.get(`${this.baseUrl}/${id}/error-report`, { responseType: 'text' });
  }

  rollback(id: string): Observable<ImportBatch> {
    return this.http.post<ImportBatch>(`${this.baseUrl}/${id}/rollback`, {}, {});
  }
}
