import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AccountingModule } from './accounting/accounting.module';
import { AuditModule } from './audit/audit.module';
import { BackupsModule } from './backups/backups.module';
import { AuthModule } from './auth/auth.module';
import { validateEnvironment } from './common/config/env.validation';
import { PrismaModule } from './common/prisma/prisma.module';
import { ClientSetupModule } from './client-setup/client-setup.module';
import { CompaniesModule } from './companies/companies.module';
import { DocumentsModule } from './documents/documents.module';
import { FixedAssetsModule } from './fixed-assets/fixed-assets.module';
import { HealthModule } from './health/health.module';
import { CounterpartiesModule } from './counterparties/counterparties.module';
import { DeclarationsModule } from './declarations/declarations.module';
import { ImportsModule } from './imports/imports.module';
import { MyDataModule } from './mydata/mydata.module';
import { ObligationsModule } from './obligations/obligations.module';
import { ReportsModule } from './reports/reports.module';
import { UsersModule } from './users/users.module';
import { PeriodClosesModule } from './period-closes/period-closes.module';
import { SupportingDocumentsModule } from './supporting-documents/supporting-documents.module';
import { DigitalMovementModule } from './digital-movement/digital-movement.module';
import { SetupModule } from './setup/setup.module';
import { PayrollModule } from './payroll/payroll.module';
import { AnnualTaxModule } from './annual-tax/annual-tax.module';
import { WithholdingTaxModule } from './withholding-tax/withholding-tax.module';
import { AnnualCertificatesModule } from './annual-certificates/annual-certificates.module';
import { EuComplianceModule } from './eu-compliance/eu-compliance.module';
import { CollectiveAgreementsModule } from './collective-agreements/collective-agreements.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          url: configService.getOrThrow<string>('REDIS_URL'),
        },
      }),
    }),
    PrismaModule,
    AuthModule,
    HealthModule,
    AuditModule,
    BackupsModule,
    AccountingModule,
    CompaniesModule,
    ClientSetupModule,
    DocumentsModule,
    MyDataModule,
    FixedAssetsModule,
    ObligationsModule,
    CounterpartiesModule,
    ImportsModule,
    DeclarationsModule,
    ReportsModule,
    UsersModule,
    PeriodClosesModule,
    SupportingDocumentsModule,
    DigitalMovementModule,
    SetupModule,
    PayrollModule,
    AnnualTaxModule,
    WithholdingTaxModule,
    AnnualCertificatesModule,
    EuComplianceModule,
    CollectiveAgreementsModule,
  ],
})
export class AppModule {}
