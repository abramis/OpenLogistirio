import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AadeRegistryProvider } from './aade-registry.provider';

describe('AadeRegistryProvider', () => {
  const originalFetch = global.fetch;
  let configService: jest.Mocked<ConfigService>;
  let provider: AadeRegistryProvider;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          AADE_REGISTRY_USERNAME: 'registry-user',
          AADE_REGISTRY_PASSWORD: 'registry-password',
          AADE_REGISTRY_ENDPOINT: 'https://registry.example.invalid',
        };
        return values[key];
      }),
    } as unknown as jest.Mocked<ConfigService>;

    provider = new AadeRegistryProvider(configService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('maps an AADE registry SOAP response to company form data', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(`
        <env:Envelope xmlns:env="http://www.w3.org/2003/05/soap-envelope">
          <env:Body>
            <rgWsPublic2AfmMethodResponse xmlns="http://rgwspublic2/RgWsPublic2Service">
              <result>
                <rg_ws_public2_result_rtType xmlns="http://rgwspublic2/RgWsPublic2">
                  <error_rec>
                    <error_code></error_code>
                    <error_descr></error_descr>
                  </error_rec>
                  <basic_rec>
                    <afm>094014298</afm>
                    <doy_descr>Φ.Α.Ε. ΑΘΗΝΩΝ</doy_descr>
                    <i_ni_flag_descr>ΜΗ ΦΠ</i_ni_flag_descr>
                    <deactivation_flag_descr>ΕΝΕΡΓΟΣ ΑΦΜ</deactivation_flag_descr>
                    <onomasia>ΤΡΑΠΕΖΑ ΠΕΙΡΑΙΩΣ Α Ε</onomasia>
                    <commer_title>ΠΕΙΡΑΙΩΣ</commer_title>
                    <legal_status_descr>ΑΕ</legal_status_descr>
                    <postal_address>ΑΜΕΡΙΚΗΣ</postal_address>
                    <postal_address_no>4</postal_address_no>
                    <postal_zip_code>10564</postal_zip_code>
                    <postal_area_description>ΑΘΗΝΑ</postal_area_description>
                    <regist_date>1916-01-01</regist_date>
                    <normal_vat_system_flag>Y</normal_vat_system_flag>
                  </basic_rec>
                  <firm_act_tab>
                    <item>
                      <firm_act_code>64191204</firm_act_code>
                      <firm_act_descr>ΥΠΗΡΕΣΙΕΣ ΤΡΑΠΕΖΩΝ</firm_act_descr>
                      <firm_act_kind>1</firm_act_kind>
                      <firm_act_kind_descr>ΚΥΡΙΑ</firm_act_kind_descr>
                    </item>
                  </firm_act_tab>
                </rg_ws_public2_result_rtType>
              </result>
            </rgWsPublic2AfmMethodResponse>
          </env:Body>
        </env:Envelope>
      `),
    } as unknown as Response);

    const result = await provider.lookupVat('094014298');

    expect(result).toEqual(
      expect.objectContaining({
        vatNumber: '094014298',
        legalName: 'ΤΡΑΠΕΖΑ ΠΕΙΡΑΙΩΣ Α Ε',
        tradeName: 'ΠΕΙΡΑΙΩΣ',
        taxOffice: 'Φ.Α.Ε. ΑΘΗΝΩΝ',
        address: 'ΑΜΕΡΙΚΗΣ 4 ΑΘΗΝΑ 10564',
        vatRegime: 'NORMAL',
        entityType: 'COMPANY',
        professionLabel: 'ΥΠΗΡΕΣΙΕΣ ΤΡΑΠΕΖΩΝ',
        activityCodes: ['64191204'],
        status: 'ΕΝΕΡΓΟΣ ΑΦΜ',
      }),
    );
  });

  it('rejects lookup when registry credentials are missing', async () => {
    configService.get.mockReturnValue(undefined);

    await expect(provider.lookupVat('094014298')).rejects.toBeInstanceOf(BadRequestException);
  });
});
