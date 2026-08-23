import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { XMLParser } from 'fast-xml-parser';

@Injectable()
export class ViesValidationService {
  private readonly parser = new XMLParser({ removeNSPrefix: true, ignoreAttributes: false });

  constructor(private readonly config: ConfigService) {}

  async check(countryCode: string, vatNumber: string, requesterVatNumber?: string) {
    const country = countryCode.trim().toUpperCase();
    const number = vatNumber
      .replace(/[^A-Z0-9]/gi, '')
      .toUpperCase()
      .replace(new RegExp(`^${country}`), '');
    if (!/^[A-Z]{2}$/.test(country) || !number)
      throw new BadRequestException('Μη έγκυρος αριθμός ΦΠΑ VIES.');
    const endpoint = this.config.get<string>(
      'VIES_SOAP_ENDPOINT',
      'https://ec.europa.eu/taxation_customs/vies/services/checkVatService',
    );
    const timeoutMs = this.config.get<number>('VIES_TIMEOUT_MS', 15000);
    const requester = requesterVatNumber?.replace(/\D/g, '');
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:ec.europa.eu:taxud:vies:services:checkVat:types">
  <soap:Body><urn:checkVat${requester ? 'Approx' : ''}><urn:countryCode>${country}</urn:countryCode><urn:vatNumber>${number}</urn:vatNumber>${requester ? `<urn:requesterCountryCode>EL</urn:requesterCountryCode><urn:requesterVatNumber>${requester}</urn:requesterVatNumber>` : ''}</urn:checkVat${requester ? 'Approx' : ''}></soap:Body>
</soap:Envelope>`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '' },
        body,
        signal: controller.signal,
      });
      const text = await response.text();
      if (!response.ok)
        throw new BadRequestException(`Η υπηρεσία VIES απάντησε HTTP ${response.status}.`);
      const parsed = this.parser.parse(text) as Record<string, unknown>;
      const result =
        findObject(parsed, 'checkVatResponse') ?? findObject(parsed, 'checkVatApproxResponse');
      if (!result) throw new BadRequestException('Μη αναγνωρίσιμη απάντηση από την υπηρεσία VIES.');
      return {
        countryCode: country,
        vatNumber: number,
        valid: String(result['valid']).toLowerCase() === 'true',
        name: stringValue(result['name']),
        address: stringValue(result['address']),
        requestDate: stringValue(result['requestDate']),
        requestIdentifier: stringValue(result['requestIdentifier']),
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new BadRequestException('Η υπηρεσία VIES δεν απάντησε έγκαιρα. Δοκιμάστε ξανά.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function findObject(value: unknown, key: string): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (
      entryKey.toLowerCase() === key.toLowerCase() &&
      entryValue &&
      typeof entryValue === 'object'
    ) {
      return entryValue as Record<string, unknown>;
    }
    const found = findObject(entryValue, key);
    if (found) return found;
  }
  return undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}
