import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { PeriodClosesController } from './period-closes.controller';
import { PeriodClosesService } from './period-closes.service';

@Module({
  imports: [PrismaModule],
  controllers: [PeriodClosesController],
  providers: [PeriodClosesService],
  exports: [PeriodClosesService],
})
export class PeriodClosesModule {}
