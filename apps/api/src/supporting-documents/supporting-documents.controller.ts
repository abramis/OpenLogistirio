import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { OFFICE_WRITE_ROLES } from '../auth/role-groups';
import { Roles } from '../auth/roles.decorator';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { TenantContext } from '../common/tenant/tenant-context';
import { SupportingDocumentsService, UploadedSupportingFile } from './supporting-documents.service';

@ApiTags('supporting-documents')
@Controller('supporting-documents')
export class SupportingDocumentsController {
  constructor(private readonly supportingDocumentsService: SupportingDocumentsService) {}

  @Post('upload/:clientCompanyId')
  @Roles(...OFFICE_WRITE_ROLES)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  upload(
    @CurrentTenant() tenant: TenantContext,
    @Param('clientCompanyId') clientCompanyId: string,
    @UploadedFile() file: UploadedSupportingFile | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('A supporting document file is required.');
    }
    return this.supportingDocumentsService.upload(tenant, clientCompanyId, file);
  }

  @Get(':id/download')
  async download(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Res({ passthrough: true }) response: { setHeader: (name: string, value: string) => void },
  ) {
    const result = await this.supportingDocumentsService.download(tenant, id);
    response.setHeader('Content-Type', result.attachment.contentType);
    response.setHeader('Content-Length', String(result.attachment.sizeBytes));
    response.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(result.attachment.originalName)}`,
    );
    return new StreamableFile(result.stream);
  }
}
