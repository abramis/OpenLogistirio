import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { XMLParser } from 'fast-xml-parser';
import {
  MyDataProvider,
  MyDataRequestDocsRequest,
  MyDataRequestDocsResponse,
  MyDataTransmissionRequest,
  MyDataTransmissionResponse,
} from './mydata-provider.interface';

@Injectable()
export class AadeMyDataTestProvider implements MyDataProvider {
  readonly providerName = 'aade-mydata';
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
    const config = this.resolveConfig(
      request.credentialEnvPrefix,
      'AADE_MYDATA_TEST_SEND_INVOICES_URL',
      'AADE_MYDATA_PRODUCTION_SEND_INVOICES_URL',
    );
    const timeoutMs = this.configService.get<number>('AADE_MYDATA_TIMEOUT_MS', 15000);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;

    try {
      response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          Accept: 'application/xml',
          'aade-user-id': config.userId,
          'ocp-apim-subscription-key': config.subscriptionKey,
        },
        body: request.payloadXml,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          status: 'failed',
          environment: config.environment,
          endpoint: config.endpoint,
          errorCode: 'AADE_TIMEOUT',
          errorMessage: `AADE myDATA request timed out after ${timeoutMs}ms.`,
        };
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }

    const responseText = await response.text();
    const parsedResponse = this.parseXmlResponse(responseText);

    if (!response.ok) {
      return {
        status: 'failed',
        environment: config.environment,
        endpoint: config.endpoint,
        httpStatus: response.status,
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
        environment: config.environment,
        endpoint: config.endpoint,
        httpStatus: response.status,
        mark: findFirstValue(parsedResponse, ['invoiceMark', 'mark']),
        uid: findFirstValue(parsedResponse, ['invoiceUid', 'uid']),
        qrUrl: findFirstValue(parsedResponse, ['qrUrl', 'qrCodeUrl']),
        rawResponse: parsedResponse,
      };
    }

    return {
      status: 'failed',
      environment: config.environment,
      endpoint: config.endpoint,
      httpStatus: response.status,
      rawResponse: parsedResponse,
      errorCode: findFirstValue(parsedResponse, ['code', 'errorCode']),
      errorMessage:
        findFirstValue(parsedResponse, ['message', 'errorMessage']) ??
        'AADE myDATA test environment rejected the document.',
    };
  }

  async requestDocs(request: MyDataRequestDocsRequest): Promise<MyDataRequestDocsResponse> {
    const config = this.resolveConfig(
      request.credentialEnvPrefix,
      request.source === 'REQUEST_TRANSMITTED_DOCS'
        ? 'AADE_MYDATA_TEST_REQUEST_TRANSMITTED_DOCS_URL'
        : 'AADE_MYDATA_TEST_REQUEST_DOCS_URL',
      request.source === 'REQUEST_TRANSMITTED_DOCS'
        ? 'AADE_MYDATA_PRODUCTION_REQUEST_TRANSMITTED_DOCS_URL'
        : 'AADE_MYDATA_PRODUCTION_REQUEST_DOCS_URL',
    );
    const timeoutMs = this.configService.get<number>('AADE_MYDATA_TIMEOUT_MS', 15000);
    const url = new URL(config.endpoint);
    url.searchParams.set('mark', request.mark);
    appendOptionalSearchParam(url, 'entityVatNumber', request.entityVatNumber);
    appendOptionalSearchParam(url, 'counterVatNumber', request.counterVatNumber);
    appendOptionalSearchParam(url, 'dateFrom', request.dateFrom);
    appendOptionalSearchParam(url, 'dateTo', request.dateTo);
    appendOptionalSearchParam(url, 'invType', request.invType);
    appendOptionalSearchParam(url, 'maxMark', request.maxMark);
    appendOptionalSearchParam(url, 'nextPartitionKey', request.nextPartitionKey);
    appendOptionalSearchParam(url, 'nextRowKey', request.nextRowKey);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;

    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/xml',
          'aade-user-id': config.userId,
          'ocp-apim-subscription-key': config.subscriptionKey,
        },
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          status: 'failed',
          environment: config.environment,
          endpoint: url.toString(),
          errorCode: 'AADE_TIMEOUT',
          errorMessage: `AADE myDATA request timed out after ${timeoutMs}ms.`,
        };
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }

    const responseText = await response.text();
    const parsedResponse = this.parseXmlResponse(responseText);

    if (!response.ok) {
      return {
        status: 'failed',
        environment: config.environment,
        endpoint: url.toString(),
        httpStatus: response.status,
        rawResponse: parsedResponse,
        errorCode: `HTTP_${response.status}`,
        errorMessage: responseText || response.statusText,
      };
    }

    return {
      status: 'received',
      environment: config.environment,
      endpoint: url.toString(),
      httpStatus: response.status,
      rawResponse: parsedResponse,
    };
  }

  private resolveConfig(
    credentialEnvPrefix: string | undefined,
    testUrlEnvName: string,
    productionUrlEnvName: string,
  ) {
    const resolvedCredentialEnvPrefix = credentialEnvPrefix ?? 'AADE_MYDATA';
    const userIdEnvName = `${resolvedCredentialEnvPrefix}_USER_ID`;
    const subscriptionKeyEnvName = `${resolvedCredentialEnvPrefix}_SUBSCRIPTION_KEY`;
    const userId = this.configService.get<string>(userIdEnvName);
    const subscriptionKey = this.configService.get<string>(subscriptionKeyEnvName);
    const environment = this.configService.get<'test' | 'production'>('AADE_MYDATA_ENV', 'test');
    const productionEnabled = this.configService.get<boolean>(
      'AADE_MYDATA_PRODUCTION_ENABLED',
      false,
    );
    const endpoint =
      environment === 'production'
        ? this.configService.getOrThrow<string>(productionUrlEnvName)
        : this.configService.getOrThrow<string>(testUrlEnvName);

    if (!userId || !subscriptionKey) {
      throw new BadRequestException(
        `Missing AADE myDATA credentials. Set ${userIdEnvName} and ${subscriptionKeyEnvName}.`,
      );
    }

    if (environment === 'production' && !productionEnabled) {
      throw new BadRequestException(
        'AADE myDATA production sends are disabled. Set AADE_MYDATA_PRODUCTION_ENABLED=true only after official production credentials, URLs, XSD validation, and accountant approval are ready.',
      );
    }

    return {
      environment,
      endpoint,
      userId,
      subscriptionKey,
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

function appendOptionalSearchParam(url: URL, key: string, value: string | undefined): void {
  if (value !== undefined && value !== '') {
    url.searchParams.set(key, value);
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
