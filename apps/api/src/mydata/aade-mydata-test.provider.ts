import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { XMLParser } from 'fast-xml-parser';
import {
  MyDataProvider,
  MyDataTransmissionRequest,
  MyDataTransmissionResponse,
} from './mydata-provider.interface';

@Injectable()
export class AadeMyDataTestProvider implements MyDataProvider {
  readonly providerName = 'aade-mydata-test';
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
  });

  constructor(private readonly configService: ConfigService) {}

  // Official AADE myDATA ERP REST API technical description checked: v2.0.2,
  // June 2026, test SendInvoices URL. Before enabling production, re-check the
  // latest official AADE specs, XSDs, authentication and test environment.
  // Never hardcode real AADE credentials and never store TAXISnet passwords.
  async transmitInvoice(request: MyDataTransmissionRequest): Promise<MyDataTransmissionResponse> {
    const credentialEnvPrefix = request.credentialEnvPrefix ?? 'AADE_MYDATA';
    const userIdEnvName = `${credentialEnvPrefix}_USER_ID`;
    const subscriptionKeyEnvName = `${credentialEnvPrefix}_SUBSCRIPTION_KEY`;
    const userId = this.configService.get<string>(userIdEnvName);
    const subscriptionKey = this.configService.get<string>(subscriptionKeyEnvName);
    const sendInvoicesUrl = this.configService.getOrThrow<string>(
      'AADE_MYDATA_TEST_SEND_INVOICES_URL',
    );

    if (!userId || !subscriptionKey) {
      throw new BadRequestException(
        `Missing AADE myDATA test credentials. Set ${userIdEnvName} and ${subscriptionKeyEnvName}.`,
      );
    }

    const response = await fetch(sendInvoicesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        Accept: 'application/xml',
        'aade-user-id': userId,
        'ocp-apim-subscription-key': subscriptionKey,
      },
      body: request.payloadXml,
    });

    const responseText = await response.text();
    const parsedResponse = this.parseXmlResponse(responseText);

    if (!response.ok) {
      return {
        status: 'failed',
        rawResponse: parsedResponse,
        errorCode: `HTTP_${response.status}`,
        errorMessage: responseText || response.statusText,
      };
    }

    const statusCode = findFirstValue(parsedResponse, ['statusCode', 'status']);
    const errors = findFirstValue(parsedResponse, ['errors', 'error']);

    if (String(statusCode).toLowerCase() === 'success' && !errors) {
      return {
        status: 'sent',
        mark: findFirstValue(parsedResponse, ['invoiceMark', 'mark']),
        uid: findFirstValue(parsedResponse, ['invoiceUid', 'uid']),
        qrUrl: findFirstValue(parsedResponse, ['qrUrl', 'qrCodeUrl']),
        rawResponse: parsedResponse,
      };
    }

    return {
      status: 'failed',
      rawResponse: parsedResponse,
      errorCode: findFirstValue(parsedResponse, ['code', 'errorCode']),
      errorMessage:
        findFirstValue(parsedResponse, ['message', 'errorMessage']) ??
        'AADE myDATA test environment rejected the document.',
    };
  }

  private parseXmlResponse(responseText: string): unknown {
    try {
      return this.parser.parse(responseText);
    } catch {
      return { rawXml: responseText };
    }
  }
}

function findFirstValue(value: unknown, keys: string[]): string | undefined {
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
      return typeof entryValue === 'string' || typeof entryValue === 'number'
        ? String(entryValue)
        : JSON.stringify(entryValue);
    }

    const found = findFirstValue(entryValue, keys);
    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}
