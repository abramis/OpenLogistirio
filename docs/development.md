# Development guide

Ο οδηγός αυτός αφορά μόνο προγραμματιστές και contributors. Τα development services έχουν
source mounts, hot reload, δημοσιευμένες θύρες και προαιρετικό demo seed. Δεν τα χρησιμοποιούμε
για πραγματικά δεδομένα λογιστικού γραφείου.

Για κανονική χρήση σε Windows επιστρέψτε στο [κύριο README](../README.md).

## Τεχνολογίες

- Monorepo με npm workspaces
- API: NestJS/Express σε Node.js
- Web: Angular
- Βάση: MySQL με Prisma
- Authentication: JWT access και refresh tokens
- Jobs: BullMQ και Redis
- API documentation: Swagger/OpenAPI
- Tests: Jest και Angular test tooling
- Lint/format: ESLint και Prettier

## Επιλογή 1: Docker Compose development

Αυτή είναι η πιο απλή development διαδρομή. Χρειάζεται Docker, αλλά όχι τοπική εγκατάσταση
Node.js, Angular CLI, MySQL ή Redis.

Σε Windows υπάρχει και το παρακάτω development shortcut από PowerShell. Ξεκινά το ίδιο
source-mounted stack και φορτώνει demo δεδομένα· δεν είναι εγκατάσταση κανονικής χρήσης:

```powershell
.\scripts\windows\start-open-logistirio.ps1
```

Από τη ρίζα του repository δημιουργήστε το development environment file.

Σε Linux/macOS:

```sh
cp .env.example .env
```

Σε PowerShell:

```powershell
Copy-Item .env.example .env
```

Ξεκινήστε πρώτα MySQL και Redis, εφαρμόστε τις υπάρχουσες migrations και, αν χρειάζεστε demo
δεδομένα, τρέξτε το seed:

```sh
docker compose up -d mysql redis
docker compose run --rm api npm run prisma:deploy -w @open-logistirio/api
docker compose run --rm api npm run seed -w @open-logistirio/api
docker compose up --build api web
```

Το `seed` είναι προαιρετικό και προορίζεται αποκλειστικά για development. Δημιουργεί demo
λογιστικό γραφείο, πελάτες και τον παρακάτω τοπικό λογαριασμό:

```text
admin@example.gr
ChangeMe123!
```

Ανοίξτε:

- Web: <http://localhost:4200>
- API health: <http://localhost:3000/api/health>
- Swagger: <http://localhost:3000/api/docs>

Για διακοπή:

```sh
docker compose down
```

Τα development MySQL και Redis δημοσιεύονται από προεπιλογή στις host θύρες `3307` και `6380`,
ώστε να αποφεύγονται συγκρούσεις με τοπικές υπηρεσίες. Μέσα στο Compose, το API χρησιμοποιεί τα
service names `mysql` και `redis` ανεξάρτητα από τις τιμές localhost του `.env`.

## Επιλογή 2: Τοπικό Node.js development

Χρησιμοποιήστε Node.js `22.22.3` ή νεότερο και npm `10` ή νεότερο. Η Angular 22 δεν χτίζει και
δεν εκτελεί tests με παλαιότερη υποστηριζόμενη έκδοση από αυτή που δηλώνει το repository.

Εγκαταστήστε dependencies:

```sh
npm install
```

Δημιουργήστε `.env` από το `.env.example` και κρατήστε, όταν MySQL και Redis τρέχουν τοπικά στις
τυπικές θύρες:

```dotenv
DATABASE_URL=mysql://openlog:openlog_password@localhost:3306/open_logistirio
REDIS_URL=redis://localhost:6379
```

### Τοπική MySQL/MariaDB

Αν υπάρχει ήδη MySQL ή MariaDB στο `localhost:3306`, δημιουργήστε βάση και development user από
phpMyAdmin ή SQL:

```sql
CREATE DATABASE open_logistirio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'openlog'@'localhost' IDENTIFIED BY 'openlog_password';
GRANT ALL PRIVILEGES ON open_logistirio.* TO 'openlog'@'localhost';
FLUSH PRIVILEGES;
```

Αν δεν υπάρχει τοπική βάση, μπορείτε να χρησιμοποιήσετε μόνο τα database/cache containers:

```sh
docker compose up -d mysql redis
```

Τότε το API που τρέχει στο host πρέπει να χρησιμοποιεί:

```dotenv
DATABASE_URL=mysql://openlog:openlog_password@localhost:3307/open_logistirio
REDIS_URL=redis://localhost:6380
```

Αν υπάρχει ήδη Redis στο `localhost:6379`, δεν χρειάζεται να ξεκινήσετε το Redis container και
κρατάτε `REDIS_URL=redis://localhost:6379`.

### Migrations και demo seed

Εφαρμόστε τις υπάρχουσες migrations και, προαιρετικά, φορτώστε demo δεδομένα:

```sh
npm run prisma:deploy -w @open-logistirio/api
npm run seed -w @open-logistirio/api
```

Το `prisma:deploy` είναι η σωστή εντολή για εφαρμογή υπαρχουσών migrations. Χρησιμοποιήστε το
`prisma:migrate` μόνο όταν αναπτύσσετε νέα migration και ο database user μπορεί να δημιουργήσει
shadow databases.

Ξεκινήστε API και web σε δύο terminals:

```sh
npm run dev -w @open-logistirio/api
```

```sh
npm run dev -w @open-logistirio/web
```

## Development environment

Το `.env.example` περιλαμβάνει ασφαλείς μόνο για τοπικό development προεπιλογές. Μην
χρησιμοποιείτε τα default database passwords ή JWT secrets σε εγκατάσταση χρήσης και μην κάνετε
commit πραγματικό `.env`.

Βασικές τιμές:

```dotenv
NODE_ENV=development
API_DOCS_ENABLED=true
API_PORT=3000
WEB_PORT=4200
FRONTEND_ORIGIN=http://localhost:4200
BACKUP_DIR=./backups
```

Οι ρυθμίσεις myDATA και Registry περιγράφονται ξεχωριστά στον [οδηγό ΑΑΔΕ](aade-setup.md).
Ποτέ δεν βάζουμε κωδικούς TAXISnet σε `.env`.

## Backups στο development

Οι admins μπορούν από την επιλογή `Αντίγραφα ασφαλείας` να δημιουργήσουν, να κατεβάσουν και να
επαναφέρουν database backup. Πριν από κάθε restore δημιουργείται αυτόματα safety backup με
κατάληξη `-pre-restore`.

Στο development Compose το `./backups` γίνεται mount στο API container, ώστε τα αρχεία να
επιβιώνουν από rebuild. Αν το API τρέχει απευθείας στο host, τα εργαλεία MariaDB Client
`mariadb-dump` και `mariadb` πρέπει να είναι διαθέσιμα στο `PATH` της διεργασίας API.

## Έλεγχοι

Ο πλήρης τοπικός release έλεγχος είναι:

```sh
npm run release:check
```

Εκτελεί lint, tests και production builds με timeouts και ελέγχει ότι το production Angular
bundle δεν περιέχει το development API URL. Δεν δημοσιεύει release και δεν γράφει στην ΑΑΔΕ.

Για τα βήματα δημοσίευσης δείτε το [release checklist](release-checklist.md).

## Σημείωση βάσης

Η κύρια βάση είναι MySQL, ώστε να συμφωνεί με τον Prisma provider και το production stack. Ένα
μελλοντικό PostgreSQL development profile θα ήταν προαιρετικό και δεν υπάρχει στην τρέχουσα
έκδοση.
