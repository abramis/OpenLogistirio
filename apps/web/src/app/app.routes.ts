import { Routes } from '@angular/router';
import { AboutPageComponent } from './features/about/about-page.component';
import { CompanyDetailsPageComponent } from './features/companies/company-details-page.component';
import { CompanyFormPageComponent } from './features/companies/company-form-page.component';
import { CompaniesListPageComponent } from './features/companies/companies-list-page.component';
import { CounterpartiesPageComponent } from './features/counterparties/counterparties-page.component';
import { DeclarationsPageComponent } from './features/declarations/declarations-page.component';
import { DocumentsListPageComponent } from './features/documents/documents-list-page.component';
import { DocumentFormPageComponent } from './features/documents/document-form-page.component';
import { DashboardPageComponent } from './features/dashboard/dashboard-page.component';
import { FixedAssetsPageComponent } from './features/fixed-assets/fixed-assets-page.component';
import { ImportsPageComponent } from './features/imports/imports-page.component';
import { LoginPageComponent } from './features/login/login-page.component';
import { ObligationsPageComponent } from './features/obligations/obligations-page.component';
import { ReportsPageComponent } from './features/reports/reports-page.component';
import { VatBookPageComponent } from './features/vat/vat-book-page.component';

export const routes: Routes = [
  {
    path: '',
    component: DashboardPageComponent,
  },
  {
    path: 'login',
    component: LoginPageComponent,
  },
  {
    path: 'companies',
    component: CompaniesListPageComponent,
  },
  {
    path: 'companies/new',
    component: CompanyFormPageComponent,
  },
  {
    path: 'companies/:id',
    component: CompanyDetailsPageComponent,
  },
  {
    path: 'companies/:id/edit',
    component: CompanyFormPageComponent,
  },
  {
    path: 'documents',
    component: DocumentsListPageComponent,
  },
  {
    path: 'documents/new',
    component: DocumentFormPageComponent,
  },
  {
    path: 'vat-book',
    component: VatBookPageComponent,
  },
  {
    path: 'counterparties',
    component: CounterpartiesPageComponent,
  },
  {
    path: 'obligations',
    component: ObligationsPageComponent,
  },
  {
    path: 'fixed-assets',
    component: FixedAssetsPageComponent,
  },
  {
    path: 'imports',
    component: ImportsPageComponent,
  },
  {
    path: 'declarations',
    component: DeclarationsPageComponent,
  },
  {
    path: 'reports',
    component: ReportsPageComponent,
  },
  {
    path: 'about',
    component: AboutPageComponent,
  },
  {
    path: '**',
    redirectTo: '',
  },
];
