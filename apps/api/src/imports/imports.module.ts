import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

@Module({
  imports: [PrismaModule],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}
