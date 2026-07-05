import { Injectable } from '@nestjs/common';
import {
  MyDataProvider,
  MyDataTransmissionRequest,
  MyDataTransmissionResponse,
} from './mydata-provider.interface';

@Injectable()
export class MockMyDataProvider implements MyDataProvider {
  readonly providerName = 'mock-mydata';

  // Real AADE API implementation must be added only after checking the latest
  // official AADE myDATA ERP technical specifications, XSDs, authentication,
  // and test-environment requirements. Never hardcode AADE credentials here,
  // and never store TAXISnet passwords.
  async transmitInvoice(request: MyDataTransmissionRequest): Promise<MyDataTransmissionResponse> {
    return {
      status: 'sent',
      mark: `MOCK-MARK-${request.documentId}`,
      uid: `MOCK-UID-${request.documentId}`,
      qrUrl: `https://mydata.example.invalid/mock/${request.documentId}`,
    };
  }
}
