import { Module } from '@nestjs/common';
import { AadeMyDataTestProvider } from './aade-mydata-test.provider';
import { MyDataController } from './mydata.controller';
import { MockMyDataProvider } from './mydata-mock.service';
import { MyDataMappingService } from './mydata-mapping.service';
import { MyDataService } from './mydata.service';
import { MyDataXmlValidationService } from './mydata-xml-validation.service';

@Module({
  controllers: [MyDataController],
  providers: [
    AadeMyDataTestProvider,
    MockMyDataProvider,
    MyDataMappingService,
    MyDataXmlValidationService,
    MyDataService,
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
