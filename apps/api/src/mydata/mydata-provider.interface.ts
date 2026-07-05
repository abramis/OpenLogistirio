export interface MyDataTransmissionRequest {
  documentId: string;
  payloadXml: string;
  credentialEnvPrefix?: string;
}

export interface MyDataTransmissionResponse {
  status: 'sent' | 'failed';
  mark?: string;
  uid?: string;
  qrUrl?: string;
  rawResponse?: unknown;
  errorCode?: string;
  errorMessage?: string;
}

export interface MyDataProvider {
  readonly providerName: string;

  transmitInvoice(request: MyDataTransmissionRequest): Promise<MyDataTransmissionResponse>;
}
