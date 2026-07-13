export interface MyDataTransmissionRequest {
  documentId: string;
  payloadXml: string;
  credentialEnvPrefix?: string;
  force?: boolean;
}

export interface MyDataExpenseClassificationRequest extends MyDataTransmissionRequest {
  postPerInvoice: boolean;
}

export interface MyDataRequestDocsRequest {
  source: 'REQUEST_DOCS' | 'REQUEST_TRANSMITTED_DOCS';
  mark: string;
  entityVatNumber?: string;
  counterVatNumber?: string;
  dateFrom?: string;
  dateTo?: string;
  invType?: string;
  maxMark?: string;
  nextPartitionKey?: string;
  nextRowKey?: string;
  credentialEnvPrefix?: string;
}

export interface MyDataCancelInvoiceRequest {
  documentId: string;
  mark: string;
  entityVatNumber?: string;
  credentialEnvPrefix?: string;
}

export interface MyDataTransmissionResponse {
  status: 'sent' | 'failed';
  environment?: string;
  endpoint?: string;
  httpStatus?: number;
  mark?: string;
  classificationMark?: string;
  cancellationMark?: string;
  uid?: string;
  qrUrl?: string;
  rawResponse?: unknown;
  errorCode?: string;
  errorMessage?: string;
}

export interface MyDataRequestDocsResponse {
  status: 'received' | 'failed';
  environment?: string;
  endpoint?: string;
  httpStatus?: number;
  rawResponse?: unknown;
  errorCode?: string;
  errorMessage?: string;
}

export interface MyDataProvider {
  readonly providerName: string;

  transmitInvoice(request: MyDataTransmissionRequest): Promise<MyDataTransmissionResponse>;

  transmitExpenseClassification?(
    request: MyDataExpenseClassificationRequest,
  ): Promise<MyDataTransmissionResponse>;

  cancelInvoice?(request: MyDataCancelInvoiceRequest): Promise<MyDataTransmissionResponse>;

  requestDocs?(request: MyDataRequestDocsRequest): Promise<MyDataRequestDocsResponse>;
}
