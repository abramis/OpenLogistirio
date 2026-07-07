import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { ShellComponent } from './layout/shell.component';
import { NgIf } from '@angular/common';

@Component({
  selector: 'ol-root',
  standalone: true,
  imports: [NgIf, RouterOutlet, ShellComponent],
  template: `
    <ol-shell *ngIf="!isLoginRoute(); else bareRoute">
      <router-outlet />
    </ol-shell>
    <ng-template #bareRoute>
      <router-outlet />
    </ng-template>
  `,
})
export class AppComponent {
  private readonly router = inject(Router);

  isLoginRoute(): boolean {
    return this.router.url.startsWith('/login');
  }
}
