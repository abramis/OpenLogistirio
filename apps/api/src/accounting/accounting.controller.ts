import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ACCOUNTING_CONTROL_ROLES } from '../auth/role-groups';
import { Roles } from '../auth/roles.decorator';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { TenantContext } from '../common/tenant/tenant-context';
import { AccountingService } from './accounting.service';
import { BulkPostDocumentsDto } from './dto/bulk-post-documents.dto';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { SeedDefaultChartDto } from './dto/seed-default-chart.dto';

@ApiTags('accounting')
@Controller('accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get('accounts')
  findAccounts(
    @CurrentTenant() tenant: TenantContext,
    @Query('clientCompanyId') clientCompanyId?: string,
  ) {
    return this.accountingService.findAccounts(tenant, clientCompanyId);
  }

  @Get('posting-rules')
  findPostingRules(
    @CurrentTenant() tenant: TenantContext,
    @Query('clientCompanyId') clientCompanyId?: string,
  ) {
    return this.accountingService.findPostingRules(tenant, clientCompanyId);
  }

  @Get('coverage')
  coverage(
    @CurrentTenant() tenant: TenantContext,
    @Query('clientCompanyId') clientCompanyId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.accountingService.coverage(tenant, clientCompanyId, dateFrom, dateTo);
  }

  @Get('journal-entries')
  findJournalEntries(
    @CurrentTenant() tenant: TenantContext,
    @Query('clientCompanyId') clientCompanyId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('source') source?: string,
  ) {
    return this.accountingService.findJournalEntries(tenant, {
      clientCompanyId,
      dateFrom,
      dateTo,
      source,
    });
  }

  @Get('documents/unposted')
  findUnpostedDocuments(
    @CurrentTenant() tenant: TenantContext,
    @Query('clientCompanyId') clientCompanyId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.accountingService.findUnpostedDocuments(tenant, clientCompanyId, dateFrom, dateTo);
  }

  @Get('periods')
  findPeriods(
    @CurrentTenant() tenant: TenantContext,
    @Query('clientCompanyId') clientCompanyId: string,
    @Query('fiscalYear') fiscalYear?: string,
  ) {
    return this.accountingService.findPeriods(
      tenant,
      clientCompanyId,
      fiscalYear ? Number(fiscalYear) : new Date().getFullYear(),
    );
  }

  @Post('accounts/seed-defaults')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  seedDefaultChart(@CurrentTenant() tenant: TenantContext, @Body() dto: SeedDefaultChartDto) {
    return this.accountingService.seedDefaultChart(tenant, dto.clientCompanyId, dto.fiscalYear);
  }

  @Post('periods/:id/close')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  closePeriod(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.accountingService.closePeriod(tenant, id);
  }

  @Post('periods/:id/lock')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  lockPeriod(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.accountingService.lockPeriod(tenant, id);
  }

  @Post('periods/:id/reopen')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  reopenPeriod(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.accountingService.reopenPeriod(tenant, id);
  }

  @Post('documents/bulk-post')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  bulkPostDocuments(@CurrentTenant() tenant: TenantContext, @Body() dto: BulkPostDocumentsDto) {
    return this.accountingService.bulkPostDocuments(tenant, dto);
  }

  @Post('entries')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  createManualEntry(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateJournalEntryDto) {
    return this.accountingService.createManualEntry(tenant, dto);
  }

  @Post('documents/:documentId/post')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  postDocument(@CurrentTenant() tenant: TenantContext, @Param('documentId') documentId: string) {
    return this.accountingService.postDocument(tenant, documentId);
  }

  @Post('fixed-asset-depreciation/:entryId/post')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  postFixedAssetDepreciation(
    @CurrentTenant() tenant: TenantContext,
    @Param('entryId') entryId: string,
  ) {
    return this.accountingService.postFixedAssetDepreciation(tenant, entryId);
  }

  @Get('trial-balance')
  trialBalance(
    @CurrentTenant() tenant: TenantContext,
    @Query('clientCompanyId') clientCompanyId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.accountingService.trialBalance(tenant, clientCompanyId, dateFrom, dateTo);
  }

  @Get('financial-statements')
  financialStatements(
    @CurrentTenant() tenant: TenantContext,
    @Query('clientCompanyId') clientCompanyId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.accountingService.financialStatements(tenant, clientCompanyId, dateFrom, dateTo);
  }

  @Get('vat-reconciliation')
  vatReconciliation(
    @CurrentTenant() tenant: TenantContext,
    @Query('clientCompanyId') clientCompanyId: string,
    @Query('year') year?: string,
  ) {
    return this.accountingService.vatReconciliation(
      tenant,
      clientCompanyId,
      year ? Number(year) : new Date().getFullYear(),
    );
  }

  @Get('ledger')
  ledger(
    @CurrentTenant() tenant: TenantContext,
    @Query('clientCompanyId') clientCompanyId: string,
    @Query('accountCode') accountCode?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.accountingService.ledger(tenant, clientCompanyId, accountCode, dateFrom, dateTo);
  }
}
