import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { validateEnvironment } from './common/config/env.validation';
import { PrismaModule } from './common/prisma/prisma.module';
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
    HealthModule,
    CompaniesModule,
    DocumentsModule,
    MyDataModule,
    FixedAssetsModule,
    ObligationsModule,
    CounterpartiesModule,
    ImportsModule,
    DeclarationsModule,
    ReportsModule,
  ],
})
export class AppModule {}
