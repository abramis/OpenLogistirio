import { ConfigService } from '@nestjs/config';
import { AadeMyDataTestProvider } from './aade-mydata-test.provider';
import { MyDataXmlValidationService } from './mydata-xml-validation.service';

describe('AadeMyDataTestProvider', () => {
  const configValues: Record<string, unknown> = {
    AADE_MYDATA_ENV: 'test',
    AADE_MYDATA_USER_ID: 'test-user',
    AADE_MYDATA_SUBSCRIPTION_KEY: 'test-key',
    AADE_MYDATA_TEST_SEND_EXPENSES_CLASSIFICATION_URL:
      'https://mydataapidev.aade.gr/SendExpensesClassification',
    AADE_MYDATA_TEST_CANCEL_INVOICE_URL: 'https://mydataapidev.aade.gr/CancelInvoice',
  };
  let configService: Pick<ConfigService, 'get' | 'getOrThrow'>;
  let xmlValidationService: jest.Mocked<
    Pick<MyDataXmlValidationService, 'validateInvoices' | 'validateExpenseClassifications'>
  >;
  let provider: AadeMyDataTestProvider;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string, fallback?: unknown) => configValues[key] ?? fallback),
      getOrThrow: jest.fn((key: string) => {
        const value = configValues[key];
        if (value === undefined) {
          throw new Error(`Missing test config ${key}`);
        }
        return value;
      }),
    };
    xmlValidationService = {
      validateInvoices: jest.fn(),
      validateExpenseClassifications: jest.fn(),
    };
    provider = new AadeMyDataTestProvider(
      configService as ConfigService,
      xmlValidationService as unknown as MyDataXmlValidationService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    configValues.AADE_MYDATA_ENV = 'test';
    delete configValues.AADE_MYDATA_PRODUCTION_READ_ENABLED;
    delete configValues.AADE_MYDATA_PRODUCTION_ENABLED;
    delete configValues.AADE_MYDATA_PRODUCTION_REQUEST_TRANSMITTED_DOCS_URL;
    delete configValues.AADE_MYDATA_PRODUCTION_SEND_EXPENSES_CLASSIFICATION_URL;
  });

  it('validates and sends expense classifications in post-per-invoice mode', async () => {
    const payloadXml = '<ExpensesClassificationsDoc />';
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          '<ResponseDoc><response><invoiceMark>4000012345</invoiceMark><classificationMark>9000012345</classificationMark><statusCode>Success</statusCode></response></ResponseDoc>',
          { status: 200 },
        ),
      );

    const result = await provider.transmitExpenseClassification({
      documentId: 'document-1',
      payloadXml,
      postPerInvoice: true,
      credentialEnvPrefix: 'AADE_MYDATA',
    });

    expect(xmlValidationService.validateExpenseClassifications).toHaveBeenCalledWith(payloadXml);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://mydataapidev.aade.gr/SendExpensesClassification?postPerInvoice=true'),
      expect.objectContaining({
        method: 'POST',
        body: payloadXml,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        status: 'sent',
        mark: '4000012345',
        classificationMark: '9000012345',
      }),
    );
  });

  it('calls CancelInvoice without an XML body and returns the cancellation MARK', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          '<ResponseDoc><response><cancellationMark>7000012345</cancellationMark><statusCode>Success</statusCode></response></ResponseDoc>',
          { status: 200 },
        ),
      );

    const result = await provider.cancelInvoice({
      documentId: 'document-1',
      mark: '4000012345',
      entityVatNumber: '999888777',
      credentialEnvPrefix: 'AADE_MYDATA',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      new URL(
        'https://mydataapidev.aade.gr/CancelInvoice?mark=4000012345&entityVatNumber=999888777',
      ),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        status: 'sent',
        mark: '4000012345',
        cancellationMark: '7000012345',
      }),
    );
  });

  it('allows explicitly enabled production reads while production writes remain disabled', async () => {
    Object.assign(configValues, {
      AADE_MYDATA_ENV: 'production',
      AADE_MYDATA_PRODUCTION_READ_ENABLED: true,
      AADE_MYDATA_PRODUCTION_ENABLED: false,
      AADE_MYDATA_PRODUCTION_REQUEST_TRANSMITTED_DOCS_URL:
        'https://mydatapi.aade.gr/myDATA/RequestTransmittedDocs',
      AADE_MYDATA_PRODUCTION_SEND_EXPENSES_CLASSIFICATION_URL:
        'https://mydatapi.aade.gr/myDATA/SendExpensesClassification',
    });
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('<RequestedDoc />', { status: 200 }));

    const readResult = await provider.requestDocs({
      source: 'REQUEST_TRANSMITTED_DOCS',
      mark: '0',
    });

    expect(readResult).toEqual(expect.objectContaining({ status: 'received', environment: 'production' }));
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://mydatapi.aade.gr/myDATA/RequestTransmittedDocs?mark=0'),
      expect.objectContaining({ method: 'GET' }),
    );
    await expect(
      provider.transmitExpenseClassification({
        documentId: 'document-1',
        payloadXml: '<ExpensesClassificationsDoc />',
        postPerInvoice: true,
      }),
    ).rejects.toThrow('production writes are disabled');
  });

  it('keeps production reads disabled unless the separate read flag is enabled', async () => {
    Object.assign(configValues, {
      AADE_MYDATA_ENV: 'production',
      AADE_MYDATA_PRODUCTION_READ_ENABLED: false,
      AADE_MYDATA_PRODUCTION_ENABLED: true,
      AADE_MYDATA_PRODUCTION_REQUEST_TRANSMITTED_DOCS_URL:
        'https://mydatapi.aade.gr/myDATA/RequestTransmittedDocs',
    });

    await expect(
      provider.requestDocs({ source: 'REQUEST_TRANSMITTED_DOCS', mark: '0' }),
    ).rejects.toThrow('production reads are disabled');
  });
});
