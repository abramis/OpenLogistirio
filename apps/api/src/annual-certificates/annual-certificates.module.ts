import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AnnualCertificatesController } from './annual-certificates.controller';
import { AnnualCertificatesService } from './annual-certificates.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [AnnualCertificatesController],
  providers: [AnnualCertificatesService],
})
export class AnnualCertificatesModule {}
