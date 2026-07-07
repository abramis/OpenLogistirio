import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface BackupFileInfo {
  fileName: string;
  sizeBytes: number;
  createdAt: string;
}

export interface RestoreBackupResult {
  restored: boolean;
  restoredFrom: string;
  safetyBackup: BackupFileInfo;
}

@Injectable({
  providedIn: 'root',
})
export class BackupsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/backups`;

  list(): Observable<BackupFileInfo[]> {
    return this.http.get<BackupFileInfo[]>(this.baseUrl, {});
  }

  create(): Observable<BackupFileInfo> {
    return this.http.post<BackupFileInfo>(this.baseUrl, {}, {});
  }

  restore(fileName: string): Observable<RestoreBackupResult> {
    return this.http.post<RestoreBackupResult>(`${this.baseUrl}/restore`, { fileName }, {});
  }

  download(fileName: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${encodeURIComponent(fileName)}/download`, {
      responseType: 'blob',
    });
  }
}
