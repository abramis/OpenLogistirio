import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:4200'),
  BACKUP_DIR: z.string().default('./backups'),
  AADE_MYDATA_ENV: z.enum(['test', 'production']).default('test'),
  AADE_MYDATA_PRODUCTION_ENABLED: z
    .preprocess((value) => value === true || value === 'true', z.boolean())
    .default(false),
  AADE_MYDATA_USER_ID: z.string().optional(),
  AADE_MYDATA_SUBSCRIPTION_KEY: z.string().optional(),
  AADE_MYDATA_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  AADE_MYDATA_TEST_SEND_INVOICES_URL: z
    .string()
    .url()
    .default('https://mydataapidev.aade.gr/SendInvoices'),
  AADE_MYDATA_TEST_SEND_EXPENSES_CLASSIFICATION_URL: z
    .string()
    .url()
    .default('https://mydataapidev.aade.gr/SendExpensesClassification'),
  AADE_MYDATA_TEST_CANCEL_INVOICE_URL: z
    .string()
    .url()
    .default('https://mydataapidev.aade.gr/CancelInvoice'),
  AADE_MYDATA_TEST_REQUEST_DOCS_URL: z
    .string()
    .url()
    .default('https://mydataapidev.aade.gr/RequestDocs'),
  AADE_MYDATA_TEST_REQUEST_TRANSMITTED_DOCS_URL: z
    .string()
    .url()
    .default('https://mydataapidev.aade.gr/RequestTransmittedDocs'),
  AADE_MYDATA_PRODUCTION_SEND_INVOICES_URL: z
    .string()
    .url()
    .default('https://mydatapi.aade.gr/myDATA/SendInvoices'),
  AADE_MYDATA_PRODUCTION_SEND_EXPENSES_CLASSIFICATION_URL: z
    .string()
    .url()
    .default('https://mydatapi.aade.gr/myDATA/SendExpensesClassification'),
  AADE_MYDATA_PRODUCTION_CANCEL_INVOICE_URL: z
    .string()
    .url()
    .default('https://mydatapi.aade.gr/myDATA/CancelInvoice'),
  AADE_MYDATA_PRODUCTION_REQUEST_DOCS_URL: z
    .string()
    .url()
    .default('https://mydatapi.aade.gr/myDATA/RequestDocs'),
  AADE_MYDATA_PRODUCTION_REQUEST_TRANSMITTED_DOCS_URL: z
    .string()
    .url()
    .default('https://mydatapi.aade.gr/myDATA/RequestTransmittedDocs'),
  AADE_REGISTRY_USERNAME: z.string().optional(),
  AADE_REGISTRY_PASSWORD: z.string().optional(),
  AADE_REGISTRY_CALLED_BY_VAT: z.string().optional(),
  AADE_REGISTRY_ENDPOINT: z
    .string()
    .url()
    .default('https://www1.gsis.gr/wsaade/RgWsPublic2/RgWsPublic2'),
});

export type EnvironmentVariables = z.infer<typeof environmentSchema>;

export function validateEnvironment(config: Record<string, unknown>): EnvironmentVariables {
  return environmentSchema.parse(config);
}
