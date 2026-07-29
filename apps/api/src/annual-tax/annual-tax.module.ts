import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AnnualTaxController } from './annual-tax.controller';
import { AnnualTaxService } from './annual-tax.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [AnnualTaxController],
  providers: [AnnualTaxService],
})
export class AnnualTaxModule {}
