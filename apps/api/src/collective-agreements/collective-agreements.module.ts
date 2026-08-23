import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { CollectiveAgreementsController } from './collective-agreements.controller';
import { CollectiveAgreementsService } from './collective-agreements.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [CollectiveAgreementsController],
  providers: [CollectiveAgreementsService],
})
export class CollectiveAgreementsModule {}
