import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface BackupFileInfo {
  fileName: string;
  sizeBytes: number;
  createdAt: string;
  checksumSha256: string | null;
}

export interface RestoreBackupResult {
  restored: boolean;
  restoredFrom: string;
  safetyBackup: BackupFileInfo;
}

export interface BackupArtifactStatus {
  fileName: string | null;
  sizeBytes: number;
  createdAt: string | null;
  ageHours: number | null;
  checksumAvailable: boolean;
  fresh: boolean;
}

export interface BackupOperationsStatus {
  healthy: boolean;
  maxAgeHours: number;
  database: BackupArtifactStatus;
  supportingDocuments: BackupArtifactStatus;
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

  status(): Observable<BackupOperationsStatus> {
    return this.http.get<BackupOperationsStatus>(`${this.baseUrl}/status`);
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
