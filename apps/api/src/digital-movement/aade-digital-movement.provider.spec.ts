import { ConfigService } from '@nestjs/config';
import { AadeDigitalMovementProvider } from './aade-digital-movement.provider';

describe('AadeDigitalMovementProvider', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sends the official RegisterTransfer XML structure', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          '<ResponseDoc><response><statusCode>Success</statusCode><transferMark>123</transferMark></response></ResponseDoc>',
          { status: 200, headers: { 'content-type': 'application/xml' } },
        ),
      );
    const provider = new AadeDigitalMovementProvider(config());
    const result = await provider.registerTransfer('AADE_MYDATA', 'https://qr.example/1', {
      transportDetail: {
        vehicleNumber: 'ΙΚΑ1234',
        transportType: 1,
        timeStamp: '2026-08-23T10:00:00Z',
        carrierVatNumber: '123456789',
      },
    });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.headers).toEqual(
      expect.objectContaining({ 'Content-Type': 'application/xml; charset=utf-8' }),
    );
    expect(String(init.body)).toContain('<Transport>');
    expect(String(init.body)).toContain('<transportDetail><vehicleNumber>ΙΚΑ1234</vehicleNumber>');
    expect(String(init.body)).toContain('<carrierVatNumber>123456789</carrierVatNumber>');
    expect(result).toMatchObject({ ok: true, mark: '123' });
  });

  it('uses the official delivery-outcome and rejection field names', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        '<ResponseDoc><response><statusCode>Success</statusCode><mark>9</mark></response></ResponseDoc>',
        {
          status: 200,
          headers: { 'content-type': 'application/xml' },
        },
      ),
    );
    const provider = new AadeDigitalMovementProvider(config());
    await provider.confirmDelivery('AADE_MYDATA', 'https://qr.example/1', {
      outcome: 'FULL',
      deliveredWithoutRecipient: false,
    });
    expect(String(fetchMock.mock.calls[0][1]?.body)).toContain('<ConfirmDeliveryOutcomeRequest>');
    expect(String(fetchMock.mock.calls[0][1]?.body)).toContain('<outcome>FULL</outcome>');
    await provider.rejectDelivery('AADE_MYDATA', 'https://qr.example/1', 'Damaged');
    expect(String(fetchMock.mock.calls[1][1]?.body)).toContain(
      '<rejectionReason>Damaged</rejectionReason>',
    );
  });
});

function config(): ConfigService {
  return new ConfigService({
    AADE_MYDATA_ENV: 'test',
    AADE_MYDATA_USER_ID: 'user',
    AADE_MYDATA_SUBSCRIPTION_KEY: 'key',
    AADE_MYDATA_TEST_REGISTER_TRANSFER_URL: 'https://example.test/RegisterTransfer',
    AADE_MYDATA_TEST_CONFIRM_DELIVERY_OUTCOME_URL: 'https://example.test/ConfirmDeliveryOutcome',
    AADE_MYDATA_TEST_REJECT_DELIVERY_NOTE_URL: 'https://example.test/RejectDeliveryNote',
    AADE_MYDATA_TIMEOUT_MS: 1000,
  });
}
