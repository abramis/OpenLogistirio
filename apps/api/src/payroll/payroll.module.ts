import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { ApdExportService } from './apd-export.service';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [PayrollController],
  providers: [PayrollService, ApdExportService],
})
export class PayrollModule {}
