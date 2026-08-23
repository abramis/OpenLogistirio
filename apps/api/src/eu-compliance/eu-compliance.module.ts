import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { EuComplianceController } from './eu-compliance.controller';
import { IntrastatService } from './intrastat.service';
import { ViesValidationService } from './vies-validation.service';
import { ViesService } from './vies.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [EuComplianceController],
  providers: [ViesService, IntrastatService, ViesValidationService],
})
export class EuComplianceModule {}
