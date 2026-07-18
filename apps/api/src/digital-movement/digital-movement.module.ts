import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { DigitalMovementController } from './digital-movement.controller';
import { DigitalMovementService } from './digital-movement.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [DigitalMovementController],
  providers: [DigitalMovementService],
})
export class DigitalMovementModule {}
