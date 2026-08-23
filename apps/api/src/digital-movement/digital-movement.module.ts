import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { DigitalMovementController } from './digital-movement.controller';
import { DigitalMovementService } from './digital-movement.service';
import { MyDataModule } from '../mydata/mydata.module';
import { AadeDigitalMovementProvider } from './aade-digital-movement.provider';

@Module({
  imports: [PrismaModule, AuditModule, MyDataModule],
  controllers: [DigitalMovementController],
  providers: [DigitalMovementService, AadeDigitalMovementProvider],
})
export class DigitalMovementModule {}
