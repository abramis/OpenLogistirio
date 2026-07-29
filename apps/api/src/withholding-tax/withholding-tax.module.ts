import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { WithholdingTaxController } from './withholding-tax.controller';
import { WithholdingTaxService } from './withholding-tax.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [WithholdingTaxController],
  providers: [WithholdingTaxService],
})
export class WithholdingTaxModule {}
