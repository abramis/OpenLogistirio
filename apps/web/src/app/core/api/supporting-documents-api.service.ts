import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface UploadedSupportingDocument {
  id: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  downloadPath: string;
  url: string;
}

@Injectable({ providedIn: 'root' })
export class SupportingDocumentsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/supporting-documents`;

  upload(clientCompanyId: string, file: File): Observable<UploadedSupportingDocument> {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.http
      .post<Omit<UploadedSupportingDocument, 'url'>>(
        `${this.baseUrl}/upload/${clientCompanyId}`,
        body,
      )
      .pipe(map((attachment) => ({ ...attachment, url: `${environment.apiBaseUrl}${attachment.downloadPath}` })));
  }

  isManagedUrl(url: string): boolean {
    return url.startsWith(`${environment.apiBaseUrl}/supporting-documents/`);
  }

  download(url: string): Observable<Blob> {
    return this.http.get(url, { responseType: 'blob' });
  }
}
