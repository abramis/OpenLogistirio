import { Body, Controller, Get, Header, Param, Post, Res, StreamableFile } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { ADMIN_ROLES } from '../auth/role-groups';
import { Roles } from '../auth/roles.decorator';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { TenantContext } from '../common/tenant/tenant-context';
import { BackupService } from './backup.service';
import { RestoreBackupDto } from './dto/restore-backup.dto';

@ApiTags('backups')
@Controller('backups')
@Roles(...ADMIN_ROLES)
export class BackupsController {
  constructor(private readonly backupService: BackupService) {}

  @Get()
  list() {
    return this.backupService.list();
  }

  @Get('status')
  status() {
    return this.backupService.operationsStatus();
  }

  @Post()
  create(@CurrentTenant() tenant: TenantContext) {
    return this.backupService.create(tenant);
  }

  @Post('restore')
  restore(@CurrentTenant() tenant: TenantContext, @Body() dto: RestoreBackupDto) {
    return this.backupService.restore(tenant, dto.fileName);
  }

  @Get(':fileName/download')
  @Header('Content-Type', 'application/sql')
  async download(
    @Param('fileName') fileName: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const download = await this.backupService.resolveDownload(fileName);
    response.setHeader('Content-Disposition', `attachment; filename="${download.fileName}"`);
    if (download.checksumSha256) {
      response.setHeader('X-Checksum-SHA256', download.checksumSha256);
    }
    return new StreamableFile(download.stream);
  }
}
