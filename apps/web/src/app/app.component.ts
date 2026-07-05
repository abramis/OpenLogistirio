import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ShellComponent } from './layout/shell.component';

@Component({
  selector: 'ol-root',
  standalone: true,
  imports: [RouterOutlet, ShellComponent],
  template: `
    <ol-shell>
      <router-outlet />
    </ol-shell>
  `,
})
export class AppComponent {}
