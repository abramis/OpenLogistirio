import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { VatNumberValidatorService } from './vat-number-validator.service';

@Module({
  imports: [AuditModule],
  controllers: [CompaniesController],
  providers: [CompaniesService, VatNumberValidatorService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
