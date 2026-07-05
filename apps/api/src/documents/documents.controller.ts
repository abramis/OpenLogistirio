import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { TenantContext } from '../common/tenant/tenant-context';
import { MyDataService } from '../mydata/mydata.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { FindDocumentsQueryDto } from './dto/find-documents-query.dto';
import { DocumentsService } from './documents.service';

@ApiTags('documents')
@ApiHeader({
  name: 'x-office-id',
  description: 'Temporary MVP tenant header. Later this comes from the JWT.',
  required: true,
})
@ApiHeader({
  name: 'x-user-id',
  description: 'Temporary MVP user header for audit logs.',
  required: false,
})
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
  create(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateDocumentDto) {
    return this.documentsService.create(tenant, dto);
  }

  @Post(':id/mydata/prepare')
  prepareMyData(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.myDataService.prepare(tenant, id);
  }

  @Post(':id/mydata/send-mock')
  sendMockMyData(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.myDataService.sendMock(tenant, id);
  }

  @Post(':id/mydata/send-test')
  sendTestMyData(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.myDataService.sendTest(tenant, id);
  }

  @Post(':id/mydata/prepare-expense')
  prepareExpenseMyData(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.myDataService.prepareExpense(tenant, id);
  }

  @Post(':id/mydata/send-expense-mock')
  sendExpenseMockMyData(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.myDataService.sendExpenseMock(tenant, id);
  }

  @Get(':id/mydata/history')
  getMyDataHistory(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.myDataService.history(tenant, id);
  }
}
