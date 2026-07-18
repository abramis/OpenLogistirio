import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AadeMyDataTestProvider } from './aade-mydata-test.provider';
import { MyDataController } from './mydata.controller';
import { MockMyDataProvider } from './mydata-mock.service';
import { MyDataMappingService } from './mydata-mapping.service';
import { MyDataService } from './mydata.service';
import { MyDataXmlValidationService } from './mydata-xml-validation.service';
import { MYDATA_SYNC_QUEUE } from './mydata-sync.queue';
import { MyDataSyncProcessor } from './mydata-sync.processor';
import { MyDataSyncScheduler } from './mydata-sync.scheduler';

@Module({
  imports: [BullModule.registerQueue({ name: MYDATA_SYNC_QUEUE })],
  controllers: [MyDataController],
  providers: [
    AadeMyDataTestProvider,
    MockMyDataProvider,
    MyDataMappingService,
    MyDataXmlValidationService,
    MyDataService,
    MyDataSyncProcessor,
    MyDataSyncScheduler,
  ],
  exports: [
    AadeMyDataTestProvider,
    MockMyDataProvider,
    MyDataMappingService,
    MyDataXmlValidationService,
    MyDataService,
  ],
})
export class MyDataModule {}
