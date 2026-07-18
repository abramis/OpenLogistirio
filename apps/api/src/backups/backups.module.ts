import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BackupsController } from './backups.controller';
import { BackupService } from './backup.service';

@Module({
  imports: [AuditModule],
  controllers: [BackupsController],
  providers: [BackupService],
})
export class BackupsModule {}
