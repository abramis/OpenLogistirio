# Open Logistirio

Open Logistirio is an independent open-source accounting-office ERP for Greece.

The project is designed around common Greek accounting-office needs: multi-tenant offices,
client companies, documents, VAT categories, AADE myDATA integration boundaries, audit logs,
exports, dashboards, and office tasks. It does not copy proprietary products, screens, texts,
database structures, icons, workflows, branding, or behavior.

## Current scope

The current release focuses on the daily work of a small or medium Greek accounting office:
multiple client companies, sales and purchase documents, revenue-expense books, VAT workpapers,
myDATA reconciliation and controlled classifications, accounting entries, period close, fixed
assets, obligations, imports, supporting documents, audit logs and backups.

Payroll/APD/ERGANI, income-tax forms and official declaration submissions are not implemented.
The software must therefore be piloted alongside the office's existing submission process; it is
not yet a complete replacement for every system used by a Greek accounting office.

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
AADE_MYDATA_PRODUCTION_READ_ENABLED=false
AADE_MYDATA_PRODUCTION_ENABLED=false
AADE_MYDATA_USER_ID=your-mydata-api-username
AADE_MYDATA_SUBSCRIPTION_KEY=your-mydata-api-subscription-key
AADE_MYDATA_TIMEOUT_MS=15000
AADE_MYDATA_TEST_SEND_INVOICES_URL=https://mydataapidev.aade.gr/SendInvoices
AADE_MYDATA_TEST_SEND_EXPENSES_CLASSIFICATION_URL=https://mydataapidev.aade.gr/SendExpensesClassification
AADE_MYDATA_TEST_CANCEL_INVOICE_URL=https://mydataapidev.aade.gr/CancelInvoice
AADE_MYDATA_TEST_REQUEST_DOCS_URL=https://mydataapidev.aade.gr/RequestDocs
AADE_MYDATA_TEST_REQUEST_TRANSMITTED_DOCS_URL=https://mydataapidev.aade.gr/RequestTransmittedDocs
AADE_MYDATA_PRODUCTION_SEND_INVOICES_URL=https://mydatapi.aade.gr/myDATA/SendInvoices
AADE_MYDATA_PRODUCTION_SEND_EXPENSES_CLASSIFICATION_URL=https://mydatapi.aade.gr/myDATA/SendExpensesClassification
AADE_MYDATA_PRODUCTION_CANCEL_INVOICE_URL=https://mydatapi.aade.gr/myDATA/CancelInvoice
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

## Production Compose

Use the separate immutable production images and reverse proxy configuration; do not use the
development `docker-compose.yml` in production. Copy and complete the production template, then
start the stack:

```bash
cp .env.production.example .env.production
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
```

Create the first real accounting-office administrator once, without loading demo data:

```bash
PRODUCTION_ENV_FILE=.env.production ./scripts/production-bootstrap.sh
```

The bootstrap refuses weak passwords, does not print the password, and refuses to create a second
office after users already exist. Never run the demo `seed` command in production.

The `migrate` job must complete successfully before the API starts. MySQL and Redis are internal
services; only the web reverse proxy is published. The API readiness probe checks both dependencies
at `/api/health/ready`. The `backup` and `files-backup` services write atomic, SHA-256-protected
database and supporting-document backups immediately and then at `BACKUP_INTERVAL_SECONDS`, pruning
local artifacts older than `BACKUP_RETENTION_DAYS`. Backups are kept in the named `backup-data`
volume; replicate them to independent, encrypted storage. After deployment run
`./scripts/production-smoke-check.sh https://your-domain` and follow the full
[production runbook](docs/production-runbook.md).

Run the isolated database and supporting-document restore drill without touching production data:

```bash
PRODUCTION_ENV_FILE=.env.production ./scripts/production-restore-drill.sh
```

Backups created from the app are stored in the local `backups/` directory and are
also available for download from the web UI.

Run checks:

```bash
npm run release:check
```

Every browser test in the release check has a hard time limit. The command also verifies that the
production Angular bundle does not contain the local-development API URL. It does not publish a
release or write to AADE.

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
AADE_MYDATA_PRODUCTION_READ_ENABLED=false
AADE_MYDATA_PRODUCTION_ENABLED=false
AADE_MYDATA_USER_ID=your-mydata-api-username
AADE_MYDATA_SUBSCRIPTION_KEY=your-mydata-api-subscription-key
AADE_MYDATA_TIMEOUT_MS=15000
AADE_MYDATA_TEST_SEND_INVOICES_URL=https://mydataapidev.aade.gr/SendInvoices
AADE_MYDATA_TEST_SEND_EXPENSES_CLASSIFICATION_URL=https://mydataapidev.aade.gr/SendExpensesClassification
AADE_MYDATA_TEST_CANCEL_INVOICE_URL=https://mydataapidev.aade.gr/CancelInvoice
AADE_MYDATA_TEST_REQUEST_DOCS_URL=https://mydataapidev.aade.gr/RequestDocs
AADE_MYDATA_TEST_REQUEST_TRANSMITTED_DOCS_URL=https://mydataapidev.aade.gr/RequestTransmittedDocs
AADE_MYDATA_PRODUCTION_SEND_INVOICES_URL=https://mydatapi.aade.gr/myDATA/SendInvoices
AADE_MYDATA_PRODUCTION_SEND_EXPENSES_CLASSIFICATION_URL=https://mydatapi.aade.gr/myDATA/SendExpensesClassification
AADE_MYDATA_PRODUCTION_CANCEL_INVOICE_URL=https://mydatapi.aade.gr/myDATA/CancelInvoice
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
setup. The AADE test send path covers issued sales documents and expense/receiver
classification for purchase invoices that have first been matched to an AADE MARK
through RequestDocs reconciliation. Expense classifications use the upgraded
`postPerInvoice=true` flow with separate E3 and VAT classification records.
Issued sales documents that have already been sent with a MARK can also be cancelled
through the guarded AADE test `CancelInvoice` flow.

Document creation also captures the AADE payment method, VAT-exemption reason,
withholding, fees, digital transaction duty, other taxes and deductions. The XML
mapper emits invoice-level `taxesTotals` and matching summary totals. Credit notes
with an original invoice MARK are sent as correlated type `5.1`; without a MARK they
are sent as uncorrelated type `5.2`. The API validates category/amount pairs and the
payable total before XML preparation.

Production AADE access is deliberately split by risk:

- `AADE_MYDATA_PRODUCTION_READ_ENABLED=true` enables only the read-only
  `RequestDocs` and `RequestTransmittedDocs` reconciliation calls
- Production writes remain disabled when only the read flag is enabled
- Every production write still requires explicit approval for the specific document or batch

Production AADE writes are deliberately double-gated:

- Set `AADE_MYDATA_ENV=production`
- Set `AADE_MYDATA_PRODUCTION_ENABLED=true`
- Re-check the latest official AADE technical specs/XSDs and endpoint URLs
- Confirm the accountant/client authorization and credentials outside the browser

Before `SendInvoices` or `SendExpensesClassification`, the backend validates the XML
against the bundled official AADE myDATA v2.0.1 XSDs. Invalid XML is rejected locally
and is never sent to AADE. The backend records the provider environment, endpoint,
correlation id, failure payload, and whether an attempt was a forced retry. Explicit
retry is allowed only after a `FAILED` attempt. A `SENT` document is never submitted
again; corrections must use cancellation or a corrective/credit document.

The client details page also includes a myDATA reconciliation panel. It calls the
AADE `RequestDocs` or `RequestTransmittedDocs` endpoint, stores the returned
AADE snapshot, reconciles it against local documents by MARK/UID or by document
number, date, VAT number and amounts, and writes the matched AADE MARK/UID back
to the local document so follow-up flows such as expense classification can use
the official correlation. Returned expense-classification and cancellation MARKs
are also correlated back to the original local document, together with the
cancellation date. The result highlights matched documents, missing ERP documents,
and amount/date/type/counterparty mismatches for accountant review.

The declarations page includes monthly and quarterly period-close reviews. Each review
captures automatic checks for unposted documents, journal balance, unresolved/failed
myDATA records, reconciliation mismatches, VAT workpaper availability and ERP-vs-AADE
VAT differences, plus a manual supporting-documents confirmation. A completed review
is submitted for an accountant/admin approval with preparer, approver and timestamps.
Accounting periods cannot be locked, and declaration workpapers cannot be approved,
until a covering period-close review has been approved.

The bundled validation schemas and implemented flows were checked against the official
myDATA ERP API/XSD v2.0.1 release (March 2026). Re-check the latest official AADE specs,
XSDs, authentication rules, and test-environment URLs before enabling production.

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
- Digital movement workspace with tenant-scoped inventory items, warehouses,
  vehicles, dispatch-note lines and AADE quantity/movement-purpose codes
- Draft/issued/received/cancelled dispatch lifecycle with atomic stock deductions,
  full, partial or rejected delivery receipts per line, manual opening adjustments,
  cancellation reversals, lifecycle history and a signed warehouse stock ledger
- Chart of accounts seed, posting rules, accounting periods, manual journal entries,
  document posting, depreciation posting, trial balance, ledger, VAT reconciliation,
  and financial-statement summaries
- Sales/purchase/credit/retail document registry
- VAT book review from documents
- myDATA XML preparation, mock send and guarded AADE send for issued sales documents
- myDATA transmission attempt history with environment, endpoint, correlation id,
  failure payload, and forced-retry markers
- Guarded AADE test cancellation for already-sent issued sales documents, with
  original/cancellation MARK correlation and cancellation timestamp
- AADE RequestDocs/RequestTransmittedDocs snapshot sync and reconciliation against
  local ERP documents
- Office-wide myDATA daily reconciliation workspace with sequential production read-only
  synchronization, AADE cursor pagination, per-client summaries and a cross-client exception queue
- Reviewed myDATA inbox workflow with duplicate-safe purchase creation, supplier master creation,
  manual matching, ignored-item reasons, reviewer timestamps and audit-log entries
- Expense/receiver myDATA preparation, mock classification, and guarded AADE test
  `SendExpensesClassification?postPerInvoice=true` for purchases with an AADE MARK
- Official AADE v2.0.1 XSD preflight validation for invoice and expense XML
- AADE payment methods, VAT-exemption reasons, invoice-level withholding/fees/digital
  transaction duty/other taxes/deductions, and correlated `5.1` vs uncorrelated `5.2`
  credit-note mapping
- Failed-only explicit resend policy; sent/cancelled documents cannot be duplicated
- Per-client AADE authorization/credential routing
- Counterparty master data for customers and suppliers per client
- CSV document import with preview, validation and import history
- VAT declaration workpapers generated from documents
- VAT workpaper reconciliation of ERP sales/purchases and VAT against deduplicated
  myDATA snapshots, including amount deltas and mismatch counts
- Monthly/quarterly close checklist with preparer/accountant approval workflow;
  approved close review is required before period locking and workpaper approval
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
- AADE transmission and phase-B lifecycle calls for digital dispatch notes; the current
  digital-movement slice is an internal inventory/dispatch workflow and never sends externally
