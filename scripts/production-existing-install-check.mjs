const baseUrl = (process.env.BASE_URL || 'http://127.0.0.1:8088').replace(/\/$/, '');
const adminEmail = 'fresh-install-admin@example.invalid';
const adminPassword = 'Fresh-Install-Key-2026!';

await waitForReadiness();

const status = await jsonRequest('/api/setup/status');
assert(status.response.status === 200, 'Setup status did not return HTTP 200 after restart.');
assert(status.body?.required === false, 'The existing installation lost its administrator.');

const login = await jsonRequest('/api/auth/login', {
  method: 'POST',
  body: { email: adminEmail, password: adminPassword },
});
assert(login.response.status === 200, 'The administrator cannot log in after restart.');

const authorization = { Authorization: `Bearer ${login.body.accessToken}` };
const users = await jsonRequest('/api/users', { headers: authorization });
assert(
  users.response.status === 200 && Array.isArray(users.body) && users.body.length === 1,
  'The existing installation did not preserve its user data.',
);
const companies = await jsonRequest('/api/companies', { headers: authorization });
assert(
  companies.response.status === 200 && Array.isArray(companies.body) && companies.body.length === 0,
  'The existing installation has unexpected client data.',
);

process.stdout.write('Restart and cross-directory data-persistence checks passed.\n');

async function waitForReadiness() {
  const deadline = Date.now() + Number(process.env.READINESS_TIMEOUT_MS || 300_000);
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health/ready`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(
    `Existing production stack did not become ready: ${lastError instanceof Error ? lastError.message : 'unknown error'}`,
  );
}

async function jsonRequest(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = text;
  }
  return { response, body };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
