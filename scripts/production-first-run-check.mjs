const baseUrl = (process.env.BASE_URL || 'http://127.0.0.1:8088').replace(/\/$/, '');
const setupToken = process.env.INITIAL_SETUP_TOKEN;

if (!setupToken || setupToken.length < 32) {
  throw new Error('INITIAL_SETUP_TOKEN with at least 32 characters is required.');
}

const adminEmail = 'fresh-install-admin@example.invalid';
const adminPassword = 'Fresh-Install-Key-2026!';

await waitForReadiness();

const initialStatus = await jsonRequest('/api/setup/status');
assert(initialStatus.response.status === 200, 'Initial setup status did not return HTTP 200.');
assert(initialStatus.body?.required === true, 'A fresh database must require initial setup.');
assert(
  initialStatus.body?.available === true,
  'Initial setup must be available with an installer token.',
);

const setupRequest = {
  setupToken,
  officeName: 'Fresh Install Accounting Office',
  officeVatNumber: '123456789',
  officeEmail: 'office@example.invalid',
  officePhone: '2101234567',
  officeAddress: 'Athens Test Address 1',
  adminFullName: 'Fresh Install Administrator',
  adminEmail,
  adminPassword,
};

const invalidToken = (setupToken[0] === 'x' ? 'y' : 'x').repeat(setupToken.length);
const refused = await jsonRequest('/api/setup', {
  method: 'POST',
  body: { ...setupRequest, setupToken: invalidToken },
});
assert(refused.response.status === 403, 'Initial setup must reject an invalid installer token.');

const initialized = await jsonRequest('/api/setup', {
  method: 'POST',
  body: setupRequest,
});
assert(initialized.response.status === 201, 'Initial setup did not return HTTP 201.');
assert(
  typeof initialized.body?.accessToken === 'string',
  'Initial setup did not return an access token.',
);
assert(
  initialized.body?.user?.email === adminEmail &&
    initialized.body?.user?.accountingOffice?.name === setupRequest.officeName,
  'Initial setup returned the wrong administrator or office.',
);

const authorization = { Authorization: `Bearer ${initialized.body.accessToken}` };
const users = await jsonRequest('/api/users', { headers: authorization });
assert(users.response.status === 200, 'The new administrator cannot read the user list.');
assert(
  Array.isArray(users.body) && users.body.length === 1,
  'A fresh install must contain one user.',
);
assert(users.body[0]?.email === adminEmail, 'A fresh install contains an unexpected demo user.');

const companies = await jsonRequest('/api/companies', { headers: authorization });
assert(companies.response.status === 200, 'The new administrator cannot read the client list.');
assert(
  Array.isArray(companies.body) && companies.body.length === 0,
  'A fresh install contains demo clients.',
);

const backup = await jsonRequest('/api/backups', {
  method: 'POST',
  headers: authorization,
  body: {},
});
assert(backup.response.status === 201, 'The administrator could not create a database backup.');
assert(
  /^open-logistirio-\d{8}-\d{6}\.sql$/.test(backup.body?.fileName),
  'The database backup has an invalid file name.',
);
assert(
  /^[a-f0-9]{64}$/.test(backup.body?.checksumSha256),
  'The database backup does not have a SHA-256 checksum.',
);

const download = await fetch(
  `${baseUrl}/api/backups/${encodeURIComponent(backup.body.fileName)}/download`,
  {
    headers: authorization,
    signal: AbortSignal.timeout(30_000),
  },
);
assert(download.status === 200, 'The database backup could not be downloaded.');
assert(
  download.headers.get('x-checksum-sha256') === backup.body.checksumSha256,
  'The downloaded database backup has the wrong checksum header.',
);
assert((await download.arrayBuffer()).byteLength > 0, 'The downloaded database backup is empty.');

const temporaryCompany = await jsonRequest('/api/companies', {
  method: 'POST',
  headers: authorization,
  body: {
    legalName: 'Temporary Restore Check Company',
    vatNumber: '987654321',
  },
});
assert(
  temporaryCompany.response.status === 201,
  'The restore check could not create its temporary company.',
);

const restored = await jsonRequest('/api/backups/restore', {
  method: 'POST',
  headers: authorization,
  body: { fileName: backup.body.fileName },
  timeoutMs: 60_000,
});
assert(restored.response.status === 201, 'The database backup could not be restored.');
assert(restored.body?.restored === true, 'The database restore did not report success.');

const companiesAfterRestore = await jsonRequest('/api/companies', { headers: authorization });
assert(
  companiesAfterRestore.response.status === 200 &&
    Array.isArray(companiesAfterRestore.body) &&
    companiesAfterRestore.body.length === 0,
  'The database restore did not return the data to its backed-up state.',
);

const repeated = await jsonRequest('/api/setup', { method: 'POST', body: setupRequest });
assert(
  repeated.response.status === 409,
  'Initial setup must be disabled after the first administrator.',
);

const finalStatus = await jsonRequest('/api/setup/status');
assert(
  finalStatus.body?.required === false,
  'Initial setup still appears active after initialization.',
);

const login = await jsonRequest('/api/auth/login', {
  method: 'POST',
  body: { email: adminEmail, password: adminPassword },
});
assert(login.response.status === 200, 'The administrator cannot log in after initial setup.');
assert(login.body?.user?.email === adminEmail, 'Login returned the wrong administrator.');

process.stdout.write(
  'Fresh production install, one-time setup, empty data, backup/restore, and login checks passed.\n',
);

async function waitForReadiness() {
  const deadline = Date.now() + Number(process.env.READINESS_TIMEOUT_MS || 300_000);
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health/ready`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (response.ok) {
        return;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  throw new Error(
    `Production stack did not become ready: ${lastError instanceof Error ? lastError.message : 'unknown error'}`,
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
    signal: AbortSignal.timeout(options.timeoutMs || 15_000),
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
  if (!condition) {
    throw new Error(message);
  }
}
