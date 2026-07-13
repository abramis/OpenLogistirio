import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

type MyDataSchema = 'InvoicesDoc-v2.0.1.xsd' | 'expensesClassification-v2.0.1.xsd';

@Injectable()
export class MyDataXmlValidationService {
  private readonly schemaDirectory = resolveSchemaDirectory();

  validateInvoices(xml: string): void {
    this.validate(xml, 'InvoicesDoc-v2.0.1.xsd', 'SendInvoices');
  }

  validateExpenseClassifications(xml: string): void {
    this.validate(
      xml,
      'expensesClassification-v2.0.1.xsd',
      'SendExpensesClassification',
    );
  }

  private validate(xml: string, schemaName: MyDataSchema, flow: string): void {
    const schemaPath = join(this.schemaDirectory, schemaName);
    const validation = spawnSync(
      'xmllint',
      ['--noout', '--nonet', '--schema', schemaPath, '-'],
      {
        input: xml,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024,
        timeout: 5000,
      },
    );

    if (validation.error) {
      throw new InternalServerErrorException({
        code: 'MYDATA_XSD_VALIDATOR_UNAVAILABLE',
        message: `${flow} XML validation could not run.`,
        errors: [validation.error.message],
      });
    }

    if (validation.status === 0) {
      return;
    }

    throw new BadRequestException({
      code: 'MYDATA_XSD_VALIDATION_FAILED',
      message: `${flow} XML failed AADE myDATA XSD v2.0.1 validation.`,
      errors: formatValidationOutput(validation.stderr),
    });
  }
}

function resolveSchemaDirectory(): string {
  const candidates = [
    join(__dirname, 'xsd', 'v2.0.1'),
    join(process.cwd(), 'src', 'mydata', 'xsd', 'v2.0.1'),
    join(process.cwd(), 'apps', 'api', 'src', 'mydata', 'xsd', 'v2.0.1'),
  ];

  const directory = candidates.find((candidate) =>
    existsSync(join(candidate, 'expensesClassification-v2.0.1.xsd')),
  );

  if (!directory) {
    throw new Error('AADE myDATA XSD v2.0.1 assets are missing from the API runtime.');
  }

  return directory;
}

function formatValidationOutput(stderr: string): string[] {
  const errors = stderr
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.endsWith('fails to validate'));

  return errors.length > 0 ? errors : ['Unknown XSD validation error.'];
}
