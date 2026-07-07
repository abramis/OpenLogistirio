import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OFFICE_WRITE_ROLES } from '../auth/role-groups';
import { Roles } from '../auth/roles.decorator';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { TenantContext } from '../common/tenant/tenant-context';
import {
  FindMyDataReconciliationQueryDto,
  SyncMyDataDocsDto,
} from './dto/sync-mydata-docs.dto';
import { MyDataService } from './mydata.service';

@ApiTags('mydata')
@Controller('mydata')
export class MyDataController {
  constructor(private readonly myDataService: MyDataService) {}

  @Post('sync')
  @Roles(...OFFICE_WRITE_ROLES)
  syncRequestDocs(@CurrentTenant() tenant: TenantContext, @Body() dto: SyncMyDataDocsDto) {
    return this.myDataService.syncRequestDocs(tenant, dto);
  }

  @Get('reconciliation')
  findReconciliation(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: FindMyDataReconciliationQueryDto,
  ) {
    return this.myDataService.findReconciliation(tenant, query);
  }
}
