import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { ObligationsController } from './obligations.controller';
import { ObligationsService } from './obligations.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [ObligationsController],
  providers: [ObligationsService],
})
export class ObligationsModule {}
