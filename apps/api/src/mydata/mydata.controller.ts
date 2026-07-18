import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { OFFICE_WRITE_ROLES } from '../auth/role-groups';
import { Roles } from '../auth/roles.decorator';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { TenantContext } from '../common/tenant/tenant-context';
import {
  FindMyDataReconciliationQueryDto,
  OfficeMyDataDashboardQueryDto,
  SyncMyDataDocsDto,
  SyncOfficeMyDataDto,
} from './dto/sync-mydata-docs.dto';
import { MyDataService } from './mydata.service';
import {
  MatchMyDataSnapshotDto,
  ReviewMyDataSnapshotDto,
} from './dto/resolve-mydata-snapshot.dto';

@ApiTags('mydata')
@Controller('mydata')
export class MyDataController {
  constructor(
    private readonly myDataService: MyDataService,
    private readonly configService: ConfigService,
  ) {}

  @Post('sync')
  @Roles(...OFFICE_WRITE_ROLES)
  syncRequestDocs(@CurrentTenant() tenant: TenantContext, @Body() dto: SyncMyDataDocsDto) {
    return this.myDataService.syncRequestDocs(tenant, dto);
  }

  @Post('sync/office')
  @Roles(...OFFICE_WRITE_ROLES)
  syncOffice(@CurrentTenant() tenant: TenantContext, @Body() dto: SyncOfficeMyDataDto) {
    return this.myDataService.syncOffice(tenant, dto);
  }

  @Get('office-dashboard')
  officeDashboard(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: OfficeMyDataDashboardQueryDto,
  ) {
    return this.myDataService.officeDashboard(tenant, query);
  }

  @Get('environment')
  environment() {
    const environment = this.configService.get<'test' | 'production'>('AADE_MYDATA_ENV', 'test');
    return {
      environment,
      productionReadEnabled:
        environment === 'production' &&
        this.configService.get<boolean>('AADE_MYDATA_PRODUCTION_READ_ENABLED', false),
      productionWriteEnabled:
        environment === 'production' &&
        this.configService.get<boolean>('AADE_MYDATA_PRODUCTION_ENABLED', false),
    };
  }

  @Post('snapshots/:id/create-purchase')
  @Roles(...OFFICE_WRITE_ROLES)
  createPurchaseFromSnapshot(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.myDataService.createPurchaseFromSnapshot(tenant, id);
  }

  @Get('snapshots/:id/purchase-preview')
  previewPurchaseFromSnapshot(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.myDataService.previewPurchaseFromSnapshot(tenant, id);
  }

  @Post('snapshots/:id/match')
  @Roles(...OFFICE_WRITE_ROLES)
  matchSnapshot(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: MatchMyDataSnapshotDto,
  ) {
    return this.myDataService.matchSnapshot(tenant, id, dto);
  }

  @Post('snapshots/:id/review')
  @Roles(...OFFICE_WRITE_ROLES)
  reviewSnapshot(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: ReviewMyDataSnapshotDto,
  ) {
    return this.myDataService.reviewSnapshot(tenant, id, dto);
  }

  @Get('snapshots/:id/candidates')
  snapshotCandidates(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.myDataService.snapshotCandidates(tenant, id);
  }

  @Get('reconciliation')
  findReconciliation(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: FindMyDataReconciliationQueryDto,
  ) {
    return this.myDataService.findReconciliation(tenant, query);
  }
}
