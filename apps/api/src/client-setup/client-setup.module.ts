import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ClientSetupController } from './client-setup.controller';
import { ClientSetupService } from './client-setup.service';

@Module({
  imports: [AuditModule],
  controllers: [ClientSetupController],
  providers: [ClientSetupService],
})
export class ClientSetupModule {}
