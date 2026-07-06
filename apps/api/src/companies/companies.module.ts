import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AadeRegistryProvider } from './aade-registry.provider';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { VatNumberValidatorService } from './vat-number-validator.service';

@Module({
  imports: [AuditModule],
  controllers: [CompaniesController],
  providers: [AadeRegistryProvider, CompaniesService, VatNumberValidatorService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
