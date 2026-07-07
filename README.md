# Open Logistirio

Open Logistirio is an independent open-source accounting-office ERP for Greece.

The project is designed around common Greek accounting-office needs: multi-tenant offices,
client companies, documents, VAT categories, AADE myDATA integration boundaries, audit logs,
exports, dashboards, and office tasks. It does not copy proprietary products, screens, texts,
database structures, icons, workflows, branding, or behavior.

## MVP Scope

The first iteration focuses on authentication, accounting offices, client companies,
documents, a revenue-expense book, general-ledger foundations, a mock and AADE-test
myDATA integration layer, audit logs, dashboards, office obligations, fixed assets,
exports, and tests.

Payroll, income tax declarations, and official declaration submissions are intentionally out of
scope for the MVP.

## Stack

- Monorepo with npm workspaces
- API: NestJS on Node.js with the Express platform adapter
- Web: Angular
- Database: MySQL with Prisma
- Auth: JWT access and refresh tokens
- Jobs: BullMQ and Redis
- API docs: Swagger/OpenAPI
- Tests: Jest for the API and Angular test tooling for the web
- Linting and formatting: ESLint and Prettier
- Dev environment: Docker Compose with API, web, MySQL, and Redis

## Environment

Create `.env` from the example:

```bash
cp .env.example .env
```

For normal local development, keep:

```bash
DATABASE_URL=mysql://openlog:openlog_password@localhost:3306/open_logistirio
REDIS_URL=redis://localhost:6379
```

For AADE myDATA test sends, fill only these values:

```bash
AADE_MYDATA_ENV=test
AADE_MYDATA_PRODUCTION_ENABLED=false
AADE_MYDATA_USER_ID=your-mydata-api-username
AADE_MYDATA_SUBSCRIPTION_KEY=your-mydata-api-subscription-key
AADE_MYDATA_TIMEOUT_MS=15000
AADE_MYDATA_TEST_SEND_INVOICES_URL=https://mydataapidev.aade.gr/SendInvoices
AADE_MYDATA_TEST_REQUEST_DOCS_URL=https://mydataapidev.aade.gr/RequestDocs
AADE_MYDATA_TEST_REQUEST_TRANSMITTED_DOCS_URL=https://mydataapidev.aade.gr/RequestTransmittedDocs
AADE_MYDATA_PRODUCTION_SEND_INVOICES_URL=https://mydatapi.aade.gr/myDATA/SendInvoices
AADE_MYDATA_PRODUCTION_REQUEST_DOCS_URL=https://mydatapi.aade.gr/myDATA/RequestDocs
AADE_MYDATA_PRODUCTION_REQUEST_TRANSMITTED_DOCS_URL=https://mydatapi.aade.gr/myDATA/RequestTransmittedDocs
```

Do not put TAXISnet passwords in `.env`.

For AADE Business Registry basic-details lookup from the client form, use the
special credentials for “Αναζήτηση Βασικών Στοιχείων Μητρώου Επιχειρήσεων”:

```bash
AADE_REGISTRY_USERNAME=your-special-registry-username
AADE_REGISTRY_PASSWORD=your-special-registry-password
AADE_REGISTRY_CALLED_BY_VAT=optional-calling-vat
AADE_REGISTRY_ENDPOINT=https://www1.gsis.gr/wsaade/RgWsPublic2/RgWsPublic2
```

These are not myDATA REST API credentials. Keep them server-side only.

If a specific client must use their own myDATA REST API credentials, do not store
the credentials in the database. In the client form set `Env reference credentials`
to something like `CLIENT_111222333`, then add:

```bash
AADE_MYDATA_CLIENT_111222333_USER_ID=client-mydata-api-username
AADE_MYDATA_CLIENT_111222333_SUBSCRIPTION_KEY=client-mydata-subscription-key
```

## Option 1: Local Development

Install dependencies from the repository root:

```bash
npm install
```

Use Node.js 22.22.3 or newer. Angular 22 will refuse to build or test on older
Node versions.

If you already have MariaDB/MySQL running on `localhost:3306`, use it. Create
the database and user from phpMyAdmin or SQL:

```sql
CREATE DATABASE open_logistirio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'openlog'@'localhost' IDENTIFIED BY 'openlog_password';
GRANT ALL PRIVILEGES ON open_logistirio.* TO 'openlog'@'localhost';
FLUSH PRIVILEGES;
```

Keep this in `.env`:

```bash
DATABASE_URL=mysql://openlog:openlog_password@localhost:3306/open_logistirio
REDIS_URL=redis://localhost:6379
```

If you already have Redis running on `localhost:6379`, do not start the Redis
container. Go straight to migrations.

If you do not have Redis locally, start the project Redis container. It is
published on host port `6380` to avoid conflicts:

```bash
docker compose up -d redis
```

In that case use:

```bash
REDIS_URL=redis://localhost:6380
```

If you do not have a local database, you can start the project MySQL too. It is
published on host port `3307` to avoid conflicts with an existing local database:

```bash
docker compose up -d mysql redis
```

In that case use:

```bash
DATABASE_URL=mysql://openlog:openlog_password@localhost:3307/open_logistirio
```

Run migrations and seed data:

```bash
npm run prisma:deploy -w @open-logistirio/api
npm run seed -w @open-logistirio/api
```

Use `prisma:migrate` only when the database user can create shadow databases.
For an existing local MariaDB/phpMyAdmin setup, `prisma:deploy` is usually the
right command.

Run the API and web app in two terminals:

```bash
npm run dev -w @open-logistirio/api
```

```bash
npm run dev -w @open-logistirio/web
```

Open:

- Web: http://localhost:4200
- API health: http://localhost:3000/api/health
- Swagger: http://localhost:3000/api/docs

Seed data creates an accounting-office admin user for local testing:

```text
admin@example.gr
ChangeMe123!
```

## Option 2: Docker Compose

Create `.env` first:

```bash
cp .env.example .env
```

Then start everything:

```bash
docker compose up --build
```

Run migrations and seed data inside the API container:

```bash
docker compose exec api npm run prisma:migrate -w @open-logistirio/api
docker compose exec api npm run seed -w @open-logistirio/api
```

For a Windows workstation that has no Node.js, Angular CLI, MySQL or Redis installed,
install Docker Desktop for Windows, keep the Docker WSL 2 backend enabled, unzip or
clone this repository, and run from PowerShell:

```powershell
.\scripts\windows\start-open-logistirio.ps1
```

The script creates `.env` if missing, starts MySQL/Redis/API/web containers, runs
database migrations, seeds the local admin user, and opens http://localhost:4200.
Use these when needed:

```powershell
.\scripts\windows\stop-open-logistirio.ps1
.\scripts\windows\update-open-logistirio.ps1
```

Backups created from the app are stored in the local `backups/` directory and are
also available for download from the web UI.

Run checks:

```bash
npm run lint
npm run test
npm run build
```

## Database Note

The primary database is MySQL to match the product stack and Prisma provider. If a PostgreSQL
development profile is desired later, it can be added as an optional Compose profile without
changing the application architecture.

## Backup And Restore

Accounting-office admins can open `Backups` in the sidebar and:

- Create a database backup with one button
- Download the generated `.sql` backup file
- Restore from a listed backup

Restore is intentionally admin-only. Before every restore, the API first creates a
`-pre-restore` safety backup, then imports the selected `.sql` file. Backup files
are stored under `BACKUP_DIR` (`./backups` by default). In Docker Compose this is
mounted to the host `backups/` folder so files survive container rebuilds.

The API container includes the MySQL client tools used by this feature. If running
without Docker on a local OS, make sure `mysqldump` and `mysql` are available in
the API process PATH.

## AADE myDATA Test Integration

The app supports a real AADE myDATA test-environment send path for `SendInvoices`.
It does not require, store, or ask for TAXISnet passwords.

Ask the accountant or business owner for:

- A myDATA REST API username (`aade-user-id`)
- The myDATA REST API subscription key (`ocp-apim-subscription-key`)
- Confirmation that the business has authorized the accountant/accounting office for
  “Διαχείριση Ηλεκτρονικών Βιβλίων” when the accountant's API user is used for clients

For the common accounting-office flow, set these values in `.env`:

```bash
AADE_MYDATA_ENV=test
AADE_MYDATA_PRODUCTION_ENABLED=false
AADE_MYDATA_USER_ID=your-mydata-api-username
AADE_MYDATA_SUBSCRIPTION_KEY=your-mydata-api-subscription-key
AADE_MYDATA_TIMEOUT_MS=15000
AADE_MYDATA_TEST_SEND_INVOICES_URL=https://mydataapidev.aade.gr/SendInvoices
AADE_MYDATA_TEST_REQUEST_DOCS_URL=https://mydataapidev.aade.gr/RequestDocs
AADE_MYDATA_TEST_REQUEST_TRANSMITTED_DOCS_URL=https://mydataapidev.aade.gr/RequestTransmittedDocs
AADE_MYDATA_PRODUCTION_SEND_INVOICES_URL=https://mydatapi.aade.gr/myDATA/SendInvoices
AADE_MYDATA_PRODUCTION_REQUEST_DOCS_URL=https://mydatapi.aade.gr/myDATA/RequestDocs
AADE_MYDATA_PRODUCTION_REQUEST_TRANSMITTED_DOCS_URL=https://mydatapi.aade.gr/myDATA/RequestTransmittedDocs
```

Then, for each client in the web app:

- Choose `Με εξουσιοδότηση προς το λογιστικό γραφείο`
- Tick `Υπάρχει εξουσιοδότηση`
- Use `Send to AADE test` only for issued sales documents supported by the current slice

For clients who should send with their own API user, choose
`Με δικά του API credentials από env`, set an env reference such as
`CLIENT_111222333`, and add matching env vars:

```bash
AADE_MYDATA_CLIENT_111222333_USER_ID=client-mydata-api-username
AADE_MYDATA_CLIENT_111222333_SUBSCRIPTION_KEY=client-mydata-subscription-key
```

Ελεύθεροι επαγγελματίες and ατομικές επιχειρήσεις are handled as client profiles
with their own ΑΦΜ, ΚΑΔ, profession label, VAT regime, books category, and myDATA
setup. The current AADE test send path still covers issued sales documents only;
expenses/receiver flows and classifications need their own implementation slices.

Production AADE sends are deliberately double-gated:

- Set `AADE_MYDATA_ENV=production`
- Set `AADE_MYDATA_PRODUCTION_ENABLED=true`
- Re-check the latest official AADE technical specs/XSDs and endpoint URLs
- Confirm the accountant/client authorization and credentials outside the browser

The backend records the provider environment, endpoint, correlation id, failure
payload, and whether an attempt was a forced retry. Already-sent documents cannot
be prepared or sent again unless the API call explicitly passes `force: true`,
so accidental duplicate transmissions are blocked by default.

The client details page also includes a myDATA reconciliation panel. It calls the
AADE `RequestDocs` or `RequestTransmittedDocs` endpoint, stores the returned
AADE snapshot without changing internal accounting documents, and reconciles it
against local documents by MARK/UID or by document number, date, VAT number and
amounts. The result highlights matched documents, missing ERP documents, and
amount/date/type/counterparty mismatches for accountant review.

The official AADE ERP REST API technical description checked for this implementation is
myDATA ERP API v2.0.2, June 2026. Re-check the latest official AADE specs, XSDs,
authentication rules, and test-environment URLs before enabling production sends.

Useful official AADE pages:

- https://www.aade.gr/mydata
- https://www.aade.gr/mydata-ilektronika-biblia-aade/mydata/dokimastiko-periballon
- https://www.aade.gr/mydata/tehnikes-prodiagrafes-ekdoseis-mydata
- https://www.aade.gr/sites/default/files/2021-07/FAQseggrafi_myDATA_REST_API_02072021.pdf

## AADE Registry Lookup

The client form includes an `Ανάκτηση από ΑΑΔΕ` action next to ΑΦΜ. It calls the
official AADE “Αναζήτηση Βασικών Στοιχείων Μητρώου Επιχειρήσεων” SOAP service
and fills the basic client profile fields returned by AADE: legal name, trade
name, tax office, address, VAT regime signal, entity type signal, primary
activity/profession, and activity codes.

To use it, the accounting office must:

- Register in the AADE registry lookup service with TAXISnet
- Create special credentials through `Διαχείριση Ειδικών Κωδικών`
- Set `AADE_REGISTRY_USERNAME` and `AADE_REGISTRY_PASSWORD` in the API
  environment

Do not store those credentials in the database or expose them in the browser.
The official AADE page checked for this implementation is:

- https://www.aade.gr/anazitisi-basikon-stoiheion-mitrooy-epiheiriseon

## Current Step

The current slice adds client tax profiles, per-client myDATA setup, AADE test-send
credential routing, office obligations/deadlines, fixed assets with annual depreciation,
general-ledger foundations, JWT authentication/RBAC, and a more complete
client/document/accounting workspace UI.

Implemented accounting-office workflows in the MVP:

- JWT login, refresh, protected API routes, role checks, and web auth state
- User settings page with authenticated password change
- Production auth state with stored/rotating refresh tokens, logout revocation,
  password reset tokens, failed-login lockout, and disabled user enforcement
- Admin-only office user management for creating users and updating roles
- Tenant-scoped audit trail with user/action/entity filters for review users
- Admin-only database backup/download/restore with automatic pre-restore safety backup
- Client tax profiles for companies, sole proprietors and freelancers
- Client setup templates for basic books, journals, movement codes, VAT setup,
  fixed asset categories, depreciation rules, tax adjustment placeholders, and
  Intrastat placeholders
- Per-document movement codes and journals from client setup, with a client
  movement/book view on the client details page
- Chart of accounts seed, posting rules, accounting periods, manual journal entries,
  document posting, depreciation posting, trial balance, ledger, VAT reconciliation,
  and financial-statement summaries
- Sales/purchase/credit/retail document registry
- VAT book review from documents
- myDATA XML preparation, mock send and guarded AADE send for issued sales documents
- myDATA transmission attempt history with environment, endpoint, correlation id,
  failure payload, and forced-retry markers
- AADE RequestDocs/RequestTransmittedDocs snapshot sync and reconciliation against
  local ERP documents
- Expense/receiver myDATA preparation and mock classification for purchase invoices
- Per-client AADE authorization/credential routing
- Counterparty master data for customers and suppliers per client
- CSV document import with preview, validation and import history
- VAT declaration workpapers generated from documents
- Office reports for summary and VAT review
- Office obligations queue with monthly generator for myDATA review and VAT obligations
- Fixed asset register with prorated annual depreciation calculation
- In-app About page that explains capabilities to accountants/users

## Client Setup Templates

After creating a client, open the client details page and use
`Παραμετροποίηση` to apply a starter setup template:

- `Απλογραφικά - ΕΛΠ`
- `Διπλογραφικά - ΕΛΠ`

The current slice stores applied setup items per client and is idempotent: running
the same template again updates the same setup codes instead of duplicating them.
It covers master/setup data that already makes sense for the MVP:
book system, future accounting-plan placeholder, account types, movement codes,
journals, VAT setup, fixed asset categories, depreciation rules, tax-adjustment
placeholders, and Intrastat placeholders.

The accounting module now seeds a starter chart of accounts and posting rules per
client. The setup template still remains useful for non-ledger operational setup
items such as movements, journals, VAT setup and fixed-asset categories.

Not production-ready yet:

- Payroll, ERGANI/APD and salary calculations
- Official TAXISnet/GGPS synchronization
- Official declaration submission flows
- Production-grade closing workflows, accountant review controls, and official
  statutory financial statement packages
- Production AADE send without re-checking the latest official specs and credentials flow
