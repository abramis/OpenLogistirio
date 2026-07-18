import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SystemHealth {
  status: 'ok';
  service: string;
  version: string;
  gitSha: string;
}

@Injectable({ providedIn: 'root' })
export class SystemApiService {
  private readonly http = inject(HttpClient);

  health(): Observable<SystemHealth> {
    return this.http.get<SystemHealth>(`${environment.apiBaseUrl}/health`);
  }
}
