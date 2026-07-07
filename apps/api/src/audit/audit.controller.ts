import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ACCOUNTING_CONTROL_ROLES } from '../auth/role-groups';
import { Roles } from '../auth/roles.decorator';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { TenantContext } from '../common/tenant/tenant-context';
import { AuditService } from './audit.service';
import { FindAuditLogsQueryDto } from './dto/find-audit-logs-query.dto';

@ApiTags('audit')
@Controller('audit')
@Roles(...ACCOUNTING_CONTROL_ROLES)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  findAll(@CurrentTenant() tenant: TenantContext, @Query() query: FindAuditLogsQueryDto) {
    return this.auditService.findAll(tenant, query);
  }
}
