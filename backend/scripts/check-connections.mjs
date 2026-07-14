import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import twilio from 'twilio';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

dotenv.config();

const results = [];

function addResult(name, ok, details) {
  results.push({ name, ok, details });
}

async function checkDatabase() {
  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
    addResult('database', true, 'Connected and executed SELECT 1.');
  } catch (error) {
    addResult('database', false, error instanceof Error ? error.message : String(error));
  } finally {
    await prisma.$disconnect();
  }
}

async function checkStorage() {
  const bucket = process.env.S3_BUCKET_NAME;
  const region = process.env.S3_REGION || 'auto';
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!bucket || !accessKeyId || !secretAccessKey) {
    addResult('storage', false, 'Missing one or more required S3/R2 env vars.');
    return;
  }

  const client = new S3Client({
    region,
    ...(endpoint ? { endpoint } : {}),
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: !!endpoint,
  });

  const key = `healthcheck/${Date.now()}-probe.txt`;

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: 'pulse-chat storage health check',
        ContentType: 'text/plain',
      })
    );

    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    addResult('storage', true, `Put/Delete succeeded in bucket ${bucket}.`);
  } catch (error) {
    addResult('storage', false, error instanceof Error ? error.message : String(error));
  }
}

async function checkTwilio() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const defaultFrom = process.env.TWILIO_DEFAULT_PHONE_NUMBER;

  if (!sid && !token) {
    addResult('twilio-auth', true, 'Credentials omitted; app will run in Twilio mock mode.');
    addResult('twilio-number', true, 'Skipped number ownership check because credentials are omitted.');
    return;
  }

  if (!sid || !token) {
    addResult('twilio-auth', false, 'TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must both be set.');
    addResult('twilio-number', false, 'Skipped number ownership check due to incomplete credentials.');
    return;
  }

  const client = twilio(sid, token);

  try {
    await client.api.accounts(sid).fetch();
    addResult('twilio-auth', true, 'Authenticated with Twilio API.');
  } catch (error) {
    addResult('twilio-auth', false, error instanceof Error ? error.message : String(error));
    addResult('twilio-number', false, 'Skipped number ownership check because auth failed.');
    return;
  }

  if (!defaultFrom) {
    addResult('twilio-number', false, 'TWILIO_DEFAULT_PHONE_NUMBER is missing.');
    return;
  }

  try {
    const owned = await client.incomingPhoneNumbers.list({ phoneNumber: defaultFrom, limit: 1 });
    if (owned.length === 0) {
      addResult('twilio-number', false, `Default number ${defaultFrom} was not found on this Twilio account.`);
      return;
    }

    const number = owned[0];
    const sms = number.capabilities?.sms === true;
    const mms = number.capabilities?.mms === true;
    addResult(
      'twilio-number',
      sms,
      `Number present on account. Capabilities: SMS=${sms}, MMS=${mms}.`
    );
  } catch (error) {
    addResult('twilio-number', false, error instanceof Error ? error.message : String(error));
  }
}

async function main() {
  await checkDatabase();
  await checkStorage();
  await checkTwilio();

  const summary = {
    ok: results.every((r) => r.ok),
    checks: results,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.ok) {
    process.exitCode = 1;
  }
}

await main();
