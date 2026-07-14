import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const emptyToUndefined = (value: unknown): unknown => {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }
  return value;
};

const rawEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    APP_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
    JWT_EXPIRES_IN: z.string().default('7d'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters long'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
    TWILIO_ACCOUNT_SID: z.preprocess(emptyToUndefined, z.string().optional()),
    TWILIO_AUTH_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
    TWILIO_DEFAULT_PHONE_NUMBER: z.string().default('+18005551234'),
    S3_BUCKET_NAME: z.string().min(1, 'S3_BUCKET_NAME is required'),
    S3_REGION: z.string().default('auto'),
    S3_ACCESS_KEY_ID: z.string().min(1, 'S3_ACCESS_KEY_ID is required'),
    S3_SECRET_ACCESS_KEY: z.string().min(1, 'S3_SECRET_ACCESS_KEY is required'),
    S3_ENDPOINT: z.preprocess(emptyToUndefined, z.string().url().optional()),
    MEDIA_BASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  })
  .superRefine((data, ctx) => {
    const hasSid = !!data.TWILIO_ACCOUNT_SID;
    const hasToken = !!data.TWILIO_AUTH_TOKEN;

    if (hasSid !== hasToken) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must both be set or both be omitted.',
      });
    }
  });

const parsedEnv = rawEnvSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('\nInvalid environment configuration:\n');
  for (const issue of parsedEnv.error.issues) {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'env';
    console.error(`- ${path}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsedEnv.data;
