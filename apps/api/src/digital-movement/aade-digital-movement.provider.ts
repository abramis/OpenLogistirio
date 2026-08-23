import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { XMLParser } from 'fast-xml-parser';

export interface AadeDispatchResponse {
  ok: boolean;
  mark?: string;
  invoiceMark?: string;
  invoiceUid?: string;
  qrUrl?: string;
  status?: string;
  error?: string;
  raw: unknown;
}

@Injectable()
export class AadeDigitalMovementProvider {
  private readonly parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
  constructor(private readonly config: ConfigService) {}

  registerTransfer(credentialRef: string | null, qrUrl: string, body: Record<string, unknown>) {
    const detail = body.transportDetail as Record<string, unknown>;
    return this.request(
      'REGISTER_TRANSFER',
      credentialRef,
      'POST',
      xml('Transport', [
        element('qrUrl', qrUrl),
        `<transportDetail>${[
          element('vehicleNumber', detail.vehicleNumber),
          element('transportType', detail.transportType),
          element('timeStamp', detail.timeStamp),
          element('carrierVatNumber', detail.carrierVatNumber),
          element('pNumber', detail.pNumber),
        ].join('')}</transportDetail>`,
      ]),
    );
  }

  confirmDelivery(credentialRef: string | null, qrUrl: string, body: Record<string, unknown>) {
    return this.request(
      'CONFIRM_DELIVERY_OUTCOME',
      credentialRef,
      'POST',
      xml('ConfirmDeliveryOutcomeRequest', [
        element('qrUrl', qrUrl),
        element('outcome', body.outcome),
        element('deliveredWithoutRecipient', body.deliveredWithoutRecipient),
      ]),
    );
  }

  rejectDelivery(credentialRef: string | null, qrUrl: string, reason?: string) {
    return this.request(
      'REJECT_DELIVERY_NOTE',
      credentialRef,
      'POST',
      xml('RejectDeliveryNoteRequest', [
        element('qrUrl', qrUrl),
        element('rejectionReason', reason),
      ]),
    );
  }

  cancelDelivery(credentialRef: string | null, mark: string) {
    return this.request('CANCEL_DELIVERY_NOTE', credentialRef, 'POST', undefined, { mark });
  }

  getStatus(credentialRef: string | null, mark: string) {
    return this.request(
      'GET_DELIVERY_NOTE_STATUS',
      credentialRef,
      'GET',
      undefined,
      { mark },
      'read',
    );
  }

  private async request(
    operation: string,
    credentialRef: string | null,
    method: 'GET' | 'POST',
    body?: string,
    search?: Record<string, string>,
    access: 'read' | 'write' = 'write',
  ): Promise<AadeDispatchResponse> {
    const environment = this.config.get<'test' | 'production'>('AADE_MYDATA_ENV', 'test');
    if (
      environment === 'production' &&
      !this.config.get<boolean>(
        access === 'read'
          ? 'AADE_MYDATA_PRODUCTION_READ_ENABLED'
          : 'AADE_MYDATA_PRODUCTION_ENABLED',
        false,
      )
    ) {
      throw new BadRequestException(`AADE production ${access}s are disabled.`);
    }
    const prefix = credentialRef?.trim() || 'AADE_MYDATA';
    const userId = this.config.get<string>(`${prefix}_USER_ID`);
    const key = this.config.get<string>(`${prefix}_SUBSCRIPTION_KEY`);
    if (!userId || !key) throw new BadRequestException(`Missing AADE credentials for ${prefix}.`);
    const envPrefix = environment === 'production' ? 'AADE_MYDATA_PRODUCTION' : 'AADE_MYDATA_TEST';
    const url = new URL(this.config.getOrThrow<string>(`${envPrefix}_${operation}_URL`));
    for (const [name, value] of Object.entries(search ?? {})) url.searchParams.set(name, value);
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.get<number>('AADE_MYDATA_TIMEOUT_MS', 15000),
    );
    try {
      const response = await fetch(url, {
        method,
        headers: {
          Accept: 'application/xml, application/json',
          'Content-Type': 'application/xml; charset=utf-8',
          'aade-user-id': userId,
          'ocp-apim-subscription-key': key,
        },
        body,
        signal: controller.signal,
      });
      const text = await response.text();
      const raw = parseResponse(text, response.headers.get('content-type'), this.parser);
      const errors = findValue(raw, ['errors', 'error', 'errorMessage', 'message']);
      const status = findValue(raw, ['statusCode', 'status']);
      const ok = response.ok && !errors && (!status || String(status).toLowerCase() === 'success');
      return {
        ok,
        mark: findValue(raw, [
          'transferMark',
          'deliveryOutcomeMark',
          'rejectMark',
          'cancellationMark',
          'mark',
        ]),
        invoiceMark: findValue(raw, ['invoiceMark']),
        invoiceUid: findValue(raw, ['invoiceUid', 'uid']),
        qrUrl: findValue(raw, ['qrUrl']),
        status,
        error: ok ? undefined : (errors ?? `HTTP ${response.status}`),
        raw,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        raw: null,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function xml(root: string, elements: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?><${root}>${elements.join('')}</${root}>`;
}

function element(name: string, value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  return `<${name}>${escapeXml(String(value))}</${name}>`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function parseResponse(text: string, contentType: string | null, parser: XMLParser): unknown {
  if (!text) return {};
  try {
    return contentType?.includes('json') ? JSON.parse(text) : parser.parse(text);
  } catch {
    return { rawResponse: text };
  }
}

function findValue(value: unknown, keys: string[]): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findValue(item, keys);
      if (found) return found;
    }
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (keys.some((candidate) => candidate.toLowerCase() === key.toLowerCase())) {
        return typeof child === 'string' || typeof child === 'number' ? String(child) : undefined;
      }
      const found = findValue(child, keys);
      if (found) return found;
    }
  }
  return undefined;
}
