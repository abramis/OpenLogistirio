import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OFFICE_WRITE_ROLES } from '../auth/role-groups';
import { Roles } from '../auth/roles.decorator';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { TenantContext } from '../common/tenant/tenant-context';
import { SendMyDataDto } from '../mydata/dto/send-mydata.dto';
import { MyDataService } from '../mydata/mydata.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { FindDocumentsQueryDto } from './dto/find-documents-query.dto';
import { DocumentsService } from './documents.service';

@ApiTags('documents')
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly myDataService: MyDataService,
  ) {}

  @Get()
  findAll(@CurrentTenant() tenant: TenantContext, @Query() query: FindDocumentsQueryDto) {
    return this.documentsService.findAll(tenant, query);
  }

  @Post()
  @Roles(...OFFICE_WRITE_ROLES)
  create(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateDocumentDto) {
    return this.documentsService.create(tenant, dto);
  }

  @Post(':id/mydata/prepare')
  @Roles(...OFFICE_WRITE_ROLES)
  prepareMyData(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.myDataService.prepare(tenant, id);
  }

  @Post(':id/mydata/send-mock')
  @Roles(...OFFICE_WRITE_ROLES)
  sendMockMyData(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: SendMyDataDto,
  ) {
    return this.myDataService.sendMock(tenant, id, dto);
  }

  @Post(':id/mydata/send-test')
  @Roles(...OFFICE_WRITE_ROLES)
  sendTestMyData(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: SendMyDataDto,
  ) {
    return this.myDataService.sendTest(tenant, id, dto);
  }

  @Post(':id/mydata/cancel-test')
  @Roles(...OFFICE_WRITE_ROLES)
  cancelTestMyData(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.myDataService.cancelTest(tenant, id);
  }

  @Post(':id/mydata/prepare-expense')
  @Roles(...OFFICE_WRITE_ROLES)
  prepareExpenseMyData(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.myDataService.prepareExpense(tenant, id);
  }

  @Post(':id/mydata/send-expense-mock')
  @Roles(...OFFICE_WRITE_ROLES)
  sendExpenseMockMyData(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.myDataService.sendExpenseMock(tenant, id);
  }

  @Post(':id/mydata/send-expense-test')
  @Roles(...OFFICE_WRITE_ROLES)
  sendExpenseTestMyData(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: SendMyDataDto,
  ) {
    return this.myDataService.sendExpenseTest(tenant, id, dto);
  }

  @Get(':id/mydata/history')
  getMyDataHistory(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.myDataService.history(tenant, id);
  }

  @Get(':id/mydata/capabilities')
  getMyDataCapabilities(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.myDataService.capabilities(tenant, id);
  }
}
