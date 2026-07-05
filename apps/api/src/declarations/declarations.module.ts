import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { DeclarationsController } from './declarations.controller';
import { DeclarationsService } from './declarations.service';

@Module({
  imports: [PrismaModule],
  controllers: [DeclarationsController],
  providers: [DeclarationsService],
})
export class DeclarationsModule {}
