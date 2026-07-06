import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { XMLParser } from 'fast-xml-parser';

export interface AadeRegistryActivity {
  code: string;
  description?: string;
  kind?: string;
  kindDescription?: string;
}

export interface AadeRegistryLookupResult {
  vatNumber: string;
  legalName?: string;
  tradeName?: string;
  taxOffice?: string;
  address?: string;
  vatRegime?: string;
  entityType?: string;
  professionLabel?: string;
  activityCodes: string[];
  activities: AadeRegistryActivity[];
  status?: string;
  registrationDate?: string;
  stopDate?: string;
  rawResponse: unknown;
}

@Injectable()
export class AadeRegistryProvider {
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    removeNSPrefix: true,
  });

  constructor(private readonly configService: ConfigService) {}

  async lookupVat(vatNumber: string): Promise<AadeRegistryLookupResult> {
    const username = this.configService.get<string>('AADE_REGISTRY_USERNAME');
    const password = this.configService.get<string>('AADE_REGISTRY_PASSWORD');
    const calledByVat = this.configService.get<string>('AADE_REGISTRY_CALLED_BY_VAT') ?? '';
    const endpoint =
      this.configService.get<string>('AADE_REGISTRY_ENDPOINT') ??
      'https://www1.gsis.gr/wsaade/RgWsPublic2/RgWsPublic2';

    if (!username || !password) {
      throw new BadRequestException(
        'Missing AADE registry credentials. Set AADE_REGISTRY_USERNAME and AADE_REGISTRY_PASSWORD.',
      );
    }

    const payloadXml = this.buildLookupXml({
      username,
      password,
      calledByVat,
      vatNumber,
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        Connection: 'keep-alive',
      },
      body: payloadXml,
    });
    const responseText = await response.text();
    const parsed = this.parseXml(responseText);

    if (!response.ok) {
      throw new BadRequestException(
        `AADE registry lookup failed with HTTP ${response.status}: ${responseText || response.statusText}`,
      );
    }

    return this.mapResponse(parsed);
  }

  private buildLookupXml(input: {
    username: string;
    password: string;
    calledByVat: string;
    vatNumber: string;
  }): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<env:Envelope
  xmlns:env="http://www.w3.org/2003/05/soap-envelope"
  xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"
  xmlns:rgw="http://rgwspublic2/RgWsPublic2Service"
  xmlns:rgw2="http://rgwspublic2/RgWsPublic2">
  <env:Header>
    <wsse:Security>
      <wsse:UsernameToken>
        <wsse:Username>${escapeXml(input.username)}</wsse:Username>
        <wsse:Password>${escapeXml(input.password)}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </env:Header>
  <env:Body>
    <rgw:rgWsPublic2AfmMethod>
      <rgw:INPUT_REC>
        <rgw2:afm_called_by>${escapeXml(input.calledByVat)}</rgw2:afm_called_by>
        <rgw2:afm_called_for>${escapeXml(input.vatNumber)}</rgw2:afm_called_for>
      </rgw:INPUT_REC>
    </rgw:rgWsPublic2AfmMethod>
  </env:Body>
</env:Envelope>`;
  }

  private parseXml(responseText: string): unknown {
    try {
      return this.parser.parse(responseText);
    } catch {
      return { rawXml: responseText };
    }
  }

  private mapResponse(parsed: unknown): AadeRegistryLookupResult {
    const faultMessage = findString(parsed, ['Text', 'faultstring']);
    if (faultMessage) {
      throw new BadRequestException(faultMessage);
    }

    const errorCode = findString(parsed, ['error_code']);
    const errorMessage = findString(parsed, ['error_descr']);
    if (errorCode) {
      throw new BadRequestException(
        `${errorCode}: ${errorMessage ?? 'AADE registry rejected the lookup.'}`,
      );
    }

    const vatNumber = findString(parsed, ['afm']);
    if (!vatNumber) {
      throw new BadRequestException('AADE registry response did not include a VAT number.');
    }

    const activities = findActivities(parsed);
    const primaryActivity = activities.find((activity) => activity.kind === '1') ?? activities[0];

    return {
      vatNumber,
      legalName: findString(parsed, ['onomasia']),
      tradeName: findString(parsed, ['commer_title']),
      taxOffice: findString(parsed, ['doy_descr']),
      address: buildAddress(parsed),
      vatRegime: mapVatRegime(findString(parsed, ['normal_vat_system_flag'])),
      entityType: mapEntityType(
        findString(parsed, ['i_ni_flag_descr']),
        findString(parsed, ['legal_status_descr']),
      ),
      professionLabel: primaryActivity?.description,
      activityCodes: activities.map((activity) => activity.code).filter(Boolean),
      activities,
      status: findString(parsed, ['deactivation_flag_descr']),
      registrationDate: findString(parsed, ['regist_date']),
      stopDate: findString(parsed, ['stop_date']),
      rawResponse: parsed,
    };
  }
}

function findString(value: unknown, keys: string[]): string | undefined {
  const found = findFirstValue(value, keys);
  if (found === undefined || found === null || typeof found === 'object') {
    return undefined;
  }
  const stringValue = String(found).trim();
  return stringValue.length > 0 ? stringValue : undefined;
}

function findFirstValue(value: unknown, keys: string[]): unknown {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstValue(item, keys);
      if (found !== undefined) {
        return found;
      }
    }
    return undefined;
  }

  if (typeof value !== 'object') {
    return undefined;
  }

  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (keys.some((key) => key.toLowerCase() === entryKey.toLowerCase())) {
      return entryValue;
    }

    const found = findFirstValue(entryValue, keys);
    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}

function findActivities(value: unknown): AadeRegistryActivity[] {
  const activityTab = findFirstValue(value, ['firm_act_tab']);
  const activityItems = toArray(
    activityTab && typeof activityTab === 'object'
      ? (activityTab as Record<string, unknown>)['item']
      : findFirstValue(value, ['item']),
  );

  return activityItems
    .map((activity) => ({
      code: findString(activity, ['firm_act_code']) ?? '',
      description: findString(activity, ['firm_act_descr']),
      kind: findString(activity, ['firm_act_kind']),
      kindDescription: findString(activity, ['firm_act_kind_descr']),
    }))
    .filter((activity) => activity.code);
}

function toArray(value: unknown): unknown[] {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function buildAddress(value: unknown): string | undefined {
  const addressParts = [
    findString(value, ['postal_address']),
    findString(value, ['postal_address_no']),
    findString(value, ['postal_area_description']),
    findString(value, ['postal_zip_code']),
  ].filter(Boolean);

  return addressParts.length > 0 ? addressParts.join(' ') : undefined;
}

function mapVatRegime(normalVatSystemFlag?: string): string | undefined {
  if (normalVatSystemFlag === 'Y' || normalVatSystemFlag === '1') {
    return 'NORMAL';
  }
  if (normalVatSystemFlag === 'N' || normalVatSystemFlag === '0') {
    return 'EXEMPT';
  }
  return undefined;
}

function mapEntityType(initialFlag?: string, legalStatus?: string): string | undefined {
  const normalizedInitialFlag = initialFlag?.trim().toUpperCase();
  const normalizedLegalStatus = legalStatus?.trim().toUpperCase();

  if (normalizedInitialFlag === 'ΦΠ') {
    return 'SOLE_PROPRIETOR';
  }

  if (normalizedLegalStatus?.includes('ΣΩΜΑΤ') || normalizedLegalStatus?.includes('ΣΥΛΛΟΓ')) {
    return 'NON_PROFIT';
  }

  if (normalizedInitialFlag === 'ΜΗ ΦΠ' || normalizedLegalStatus) {
    return 'COMPANY';
  }

  return undefined;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
