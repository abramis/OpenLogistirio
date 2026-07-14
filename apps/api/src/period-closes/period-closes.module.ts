import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { PeriodClosesController } from './period-closes.controller';
import { PeriodClosesService } from './period-closes.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [PeriodClosesController],
  providers: [PeriodClosesService],
  exports: [PeriodClosesService],
})
export class PeriodClosesModule {}
