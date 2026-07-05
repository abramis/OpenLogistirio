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
  AADE_MYDATA_ENV: z.enum(['test', 'production-disabled']).default('test'),
  AADE_MYDATA_USER_ID: z.string().optional(),
  AADE_MYDATA_SUBSCRIPTION_KEY: z.string().optional(),
  AADE_MYDATA_TEST_SEND_INVOICES_URL: z
    .string()
    .url()
    .default('https://mydataapidev.aade.gr/SendInvoices'),
});

export type EnvironmentVariables = z.infer<typeof environmentSchema>;

export function validateEnvironment(config: Record<string, unknown>): EnvironmentVariables {
  return environmentSchema.parse(config);
}
