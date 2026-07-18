import { Routes } from '@angular/router';
import { authMatchGuard, roleMatchGuard } from './core/auth/auth.guard';
import { ACCOUNTING_CONTROL_ROLES, ADMIN_ROLES } from './core/auth/user-roles';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/dashboard/dashboard-page.component').then((m) => m.DashboardPageComponent),
    canMatch: [authMatchGuard],
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login-page.component').then((m) => m.LoginPageComponent),
  },
  {
    path: 'companies',
    loadComponent: () =>
      import('./features/companies/companies-list-page.component').then(
        (m) => m.CompaniesListPageComponent,
      ),
    canMatch: [authMatchGuard],
  },
  {
    path: 'companies/new',
    loadComponent: () =>
      import('./features/companies/company-form-page.component').then(
        (m) => m.CompanyFormPageComponent,
      ),
    canMatch: [authMatchGuard],
  },
  {
    path: 'companies/:id',
    loadComponent: () =>
      import('./features/companies/company-details-page.component').then(
        (m) => m.CompanyDetailsPageComponent,
      ),
    canMatch: [authMatchGuard],
  },
  {
    path: 'companies/:id/edit',
    loadComponent: () =>
      import('./features/companies/company-form-page.component').then(
        (m) => m.CompanyFormPageComponent,
      ),
    canMatch: [authMatchGuard],
  },
  {
    path: 'documents',
    loadComponent: () =>
      import('./features/documents/documents-list-page.component').then(
        (m) => m.DocumentsListPageComponent,
      ),
    canMatch: [authMatchGuard],
  },
  {
    path: 'documents/new',
    loadComponent: () =>
      import('./features/documents/document-form-page.component').then(
        (m) => m.DocumentFormPageComponent,
      ),
    canMatch: [authMatchGuard],
  },
  {
    path: 'mydata',
    loadComponent: () =>
      import('./features/mydata/mydata-office-page.component').then(
        (m) => m.MyDataOfficePageComponent,
      ),
    canMatch: [authMatchGuard],
  },
  {
    path: 'vat-book',
    loadComponent: () =>
      import('./features/vat/vat-book-page.component').then((m) => m.VatBookPageComponent),
    canMatch: [authMatchGuard],
  },
  {
    path: 'accounting',
    loadComponent: () =>
      import('./features/accounting/accounting-page.component').then(
        (m) => m.AccountingPageComponent,
      ),
    canMatch: [authMatchGuard],
  },
  {
    path: 'counterparties',
    loadComponent: () =>
      import('./features/counterparties/counterparties-page.component').then(
        (m) => m.CounterpartiesPageComponent,
      ),
    canMatch: [authMatchGuard],
  },
  {
    path: 'obligations',
    loadComponent: () =>
      import('./features/obligations/obligations-page.component').then(
        (m) => m.ObligationsPageComponent,
      ),
    canMatch: [authMatchGuard],
  },
  {
    path: 'fixed-assets',
    loadComponent: () =>
      import('./features/fixed-assets/fixed-assets-page.component').then(
        (m) => m.FixedAssetsPageComponent,
      ),
    canMatch: [authMatchGuard],
  },
  {
    path: 'digital-movement',
    loadComponent: () =>
      import('./features/digital-movement/digital-movement-page.component').then(
        (m) => m.DigitalMovementPageComponent,
      ),
    canMatch: [authMatchGuard],
  },
  {
    path: 'imports',
    loadComponent: () =>
      import('./features/imports/imports-page.component').then((m) => m.ImportsPageComponent),
    canMatch: [authMatchGuard],
  },
  {
    path: 'declarations',
    loadComponent: () =>
      import('./features/declarations/declarations-page.component').then(
        (m) => m.DeclarationsPageComponent,
      ),
    canMatch: [authMatchGuard],
  },
  {
    path: 'reports',
    loadComponent: () =>
      import('./features/reports/reports-page.component').then((m) => m.ReportsPageComponent),
    canMatch: [authMatchGuard],
  },
  {
    path: 'audit',
    loadComponent: () =>
      import('./features/audit/audit-page.component').then((m) => m.AuditPageComponent),
    canMatch: [authMatchGuard, roleMatchGuard],
    data: { roles: ACCOUNTING_CONTROL_ROLES },
  },
  {
    path: 'users',
    loadComponent: () =>
      import('./features/users/users-page.component').then((m) => m.UsersPageComponent),
    canMatch: [authMatchGuard, roleMatchGuard],
    data: { roles: ADMIN_ROLES },
  },
  {
    path: 'backups',
    loadComponent: () =>
      import('./features/backups/backups-page.component').then((m) => m.BackupsPageComponent),
    canMatch: [authMatchGuard, roleMatchGuard],
    data: { roles: ADMIN_ROLES },
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/settings-page.component').then((m) => m.SettingsPageComponent),
    canMatch: [authMatchGuard],
  },
  {
    path: 'about',
    loadComponent: () =>
      import('./features/about/about-page.component').then((m) => m.AboutPageComponent),
    canMatch: [authMatchGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
