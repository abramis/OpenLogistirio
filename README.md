# Open Logistirio

Open Logistirio is an independent open-source accounting-office ERP for Greece.

The project is designed around common Greek accounting-office needs: multi-tenant offices,
client companies, documents, VAT categories, AADE myDATA integration boundaries, audit logs,
exports, dashboards, and office tasks. It does not copy proprietary products, screens, texts,
database structures, icons, workflows, branding, or behavior.

## MVP Scope

The first iteration focuses on authentication, accounting offices, client companies,
documents, a revenue-expense book, a mock and AADE-test myDATA integration layer, audit logs,
dashboards, office obligations, fixed assets, exports, and tests.

Payroll, income tax declarations, and a full general ledger are intentionally out of scope for
the MVP.

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
AADE_MYDATA_USER_ID=your-mydata-api-username
AADE_MYDATA_SUBSCRIPTION_KEY=your-mydata-api-subscription-key
AADE_MYDATA_TEST_SEND_INVOICES_URL=https://mydataapidev.aade.gr/SendInvoices
```

Do not put TAXISnet passwords in `.env`.

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
AADE_MYDATA_USER_ID=your-mydata-api-username
AADE_MYDATA_SUBSCRIPTION_KEY=your-mydata-api-subscription-key
AADE_MYDATA_TEST_SEND_INVOICES_URL=https://mydataapidev.aade.gr/SendInvoices
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

The official AADE ERP REST API technical description checked for this implementation is
myDATA ERP API v2.0.2, June 2026. Re-check the latest official AADE specs, XSDs,
authentication rules, and test-environment URLs before enabling production sends.

Useful official AADE pages:

- https://www.aade.gr/mydata
- https://www.aade.gr/mydata-ilektronika-biblia-aade/mydata/dokimastiko-periballon
- https://www.aade.gr/mydata/tehnikes-prodiagrafes-ekdoseis-mydata
- https://www.aade.gr/sites/default/files/2021-07/FAQseggrafi_myDATA_REST_API_02072021.pdf

## Current Step

The current slice adds client tax profiles, per-client myDATA setup, AADE test-send
credential routing, office obligations/deadlines, fixed assets with annual depreciation,
and a more complete client/document workspace UI.

Implemented accounting-office workflows in the MVP:

- Client tax profiles for companies, sole proprietors and freelancers
- Sales/purchase/credit/retail document registry
- VAT book review from documents
- myDATA XML preparation, mock send and AADE test send for issued sales documents
- Expense/receiver myDATA preparation and mock classification for purchase invoices
- Per-client AADE authorization/credential routing
- Counterparty master data for customers and suppliers per client
- CSV document import with preview, validation and import history
- VAT declaration workpapers generated from documents
- Office reports for summary and VAT review
- Office obligations queue with monthly generator for myDATA review and VAT obligations
- Fixed asset register with prorated annual depreciation calculation
- In-app About page that explains capabilities to accountants/users

Not production-ready yet:

- Payroll, ERGANI/APD and salary calculations
- Official TAXISnet/GGPS synchronization
- Official declaration submission flows
- Full general ledger and accounting entries
- Production AADE send without re-checking the latest official specs and credentials flow
