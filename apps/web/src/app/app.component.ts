import { Location, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ShellComponent } from './layout/shell.component';

@Component({
  selector: 'ol-root',
  standalone: true,
  imports: [NgIf, RouterOutlet, ShellComponent],
  template: `
    <ol-shell *ngIf="!isBareRoute(); else bareRoute">
      <router-outlet />
    </ol-shell>
    <ng-template #bareRoute>
      <router-outlet />
    </ng-template>
  `,
})
export class AppComponent {
  private readonly location = inject(Location);

  isBareRoute(): boolean {
    return isBarePath(this.location.path());
  }
}

export function isBarePath(path: string): boolean {
  return (
    path === '/login' ||
    path.startsWith('/login?') ||
    path === '/setup' ||
    path.startsWith('/setup?')
  );
}
