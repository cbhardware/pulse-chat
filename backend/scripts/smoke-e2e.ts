type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

type SignupResponse = TokenPair & {
  token: string;
  user: {
    id: string;
    phoneNumber: string;
    name: string | null;
    isAppUser: boolean;
  };
};

function getBaseUrl(): string {
  const value = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
  return value.replace(/\/$/, '');
}

function randomPhone(): string {
  const suffix = Math.floor(Math.random() * 9000000) + 1000000;
  return `+1555${suffix}`;
}

function assertOk(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function postJson<T>(
  baseUrl: string,
  path: string,
  body: unknown,
  accessToken?: string
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`POST ${path} failed (${response.status}): ${text}`);
  }

  return JSON.parse(text) as T;
}

async function getJson<T>(baseUrl: string, path: string, accessToken?: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`GET ${path} failed (${response.status}): ${text}`);
  }

  return JSON.parse(text) as T;
}

async function uploadTinyPng(baseUrl: string): Promise<{ url: string; key: string }> {
  // 1x1 transparent PNG
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2qN4kAAAAASUVORK5CYII=';
  const bytes = Buffer.from(pngBase64, 'base64');

  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'image/png' }), 'smoke.png');

  const response = await fetch(`${baseUrl}/api/v1/media/upload`, {
    method: 'POST',
    body: form,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`POST /api/v1/media/upload failed (${response.status}): ${text}`);
  }

  const payload = JSON.parse(text) as { url?: string; key?: string };
  assertOk(payload.url, 'Upload response missing url');
  assertOk(payload.key, 'Upload response missing key');

  return {
    url: payload.url,
    key: payload.key,
  };
}

async function run(): Promise<void> {
  const baseUrl = getBaseUrl();
  const phoneNumber = process.env.SMOKE_PHONE_NUMBER || randomPhone();
  const password = process.env.SMOKE_PASSWORD || 'Password123!';
  const smsTarget = process.env.SMOKE_SMS_TARGET || '+15550000002';

  console.log(`[Smoke] Base URL: ${baseUrl}`);

  const health = await getJson<{ status: string }>(baseUrl, '/health');
  assertOk(health.status === 'ok', 'Health check did not return status=ok');
  console.log('[Smoke] Health check passed');

  const signup = await postJson<SignupResponse>(baseUrl, '/api/v1/auth/signup', {
    phoneNumber,
    password,
    name: 'Smoke Runner',
  });
  const accessToken = signup.accessToken || signup.token;
  assertOk(accessToken, 'Signup response missing access token');
  console.log('[Smoke] Signup passed');

  const me = await getJson<{ id: string; phoneNumber: string }>(baseUrl, '/api/v1/auth/me', accessToken);
  assertOk(me.phoneNumber === phoneNumber, 'Profile phone number mismatch');
  console.log('[Smoke] Auth me passed');

  const group = await postJson<{ id: string; name: string }>(
    baseUrl,
    '/api/v1/groups',
    {
      name: `Smoke Group ${Date.now()}`,
      description: 'Automated smoke-test group',
      smsPhoneNumbers: [smsTarget],
    },
    accessToken
  );
  assertOk(group.id, 'Group creation missing id');
  console.log('[Smoke] Group creation passed');

  const uploaded = await uploadTinyPng(baseUrl);
  console.log('[Smoke] Media upload passed');

  await postJson(
    baseUrl,
    `/api/v1/groups/${group.id}/messages`,
    {
      content: 'Smoke test text + media',
      messageType: 'IMAGE',
      mediaUrl: uploaded.url,
      mediaMimeType: 'image/png',
    },
    accessToken
  );
  console.log('[Smoke] Message send passed');

  const messages = await getJson<Array<{ id: string; content: string | null }>>(
    baseUrl,
    `/api/v1/groups/${group.id}/messages`,
    accessToken
  );
  assertOk(messages.length > 0, 'No messages found after send');
  console.log('[Smoke] Message retrieval passed');

  console.log('SMOKE TEST PASSED');
}

run().catch((error) => {
  console.error('SMOKE TEST FAILED:', error);
  process.exit(1);
});
