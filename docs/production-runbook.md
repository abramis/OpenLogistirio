# Production runbook

Το runbook αφορά εγκατάσταση του Open Logistirio σε έναν πραγματικό server λογιστικού γραφείου.
Δεν ενεργοποιεί production εγγραφές προς ΑΑΔΕ.

## 1. Προϋποθέσεις server

- Υποστηριζόμενη Linux διανομή με ενημερώσεις ασφαλείας.
- Docker Engine και Docker Compose plugin.
- Domain με HTTPS/TLS και περιορισμένη πρόσβαση διαχείρισης μέσω SSH/VPN.
- Ανεξάρτητος, κρυπτογραφημένος προορισμός για off-site backups.
- Παρακολούθηση διαθέσιμου χώρου, RAM, container health και λήξης TLS certificate.

Η MySQL και το Redis δεν δημοσιεύονται στο Internet. Μόνο το reverse-proxy web service εκθέτει
θύρα. Τα `.env.production` και backup αρχεία δεν μπαίνουν στο Git.

## 2. Αρχική εγκατάσταση

```sh
cp .env.production.example .env.production
chmod 600 .env.production
docker compose --env-file .env.production -f docker-compose.production.yml config --quiet
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
PRODUCTION_ENV_FILE=.env.production ./scripts/production-bootstrap.sh
./scripts/production-smoke-check.sh https://your-domain.example
```

Πριν από το `up`, αλλάζουμε όλα τα placeholder secrets. Τα JWT, MySQL, Redis και restore-drill
secrets είναι διαφορετικά μεταξύ τους και παράγονται από ασφαλή random generator/password manager.
Το production bootstrap εκτελείται μία φορά, δημιουργεί το πραγματικό λογιστικό γραφείο και τον
πρώτο διαχειριστή και αρνείται να φορτώσει demo χρήστη. Δεν τρέχουμε ποτέ `prisma/seed.ts` σε
production.

## 2.1 Release gate πριν από εγκατάσταση

```sh
npm ci
npm run release:check
```

Το release gate έχει αυστηρά timeouts, κάνει lint/tests/build και ελέγχει ότι το production web
bundle δεν δείχνει στο localhost. Πριν από δημόσιο production tag ακολουθούμε και το
[release checklist](release-checklist.md).

## 3. Πολιτική AADE

- `AADE_MYDATA_PRODUCTION_ENABLED=false` μέχρι να δοθεί ρητή εντολή για συγκεκριμένο
  παραστατικό ή batch.
- Η ανάγνωση production snapshots ενεργοποιείται χωριστά με
  `AADE_MYDATA_PRODUCTION_READ_ENABLED=true`.
- Η αλλαγή credential ή subscription key γίνεται στο server secret store/`.env.production`,
  ακολουθεί restart του API και read-only έλεγχος.
- Το nightly incremental sync ενεργοποιείται χωριστά με
  MYDATA_SCHEDULED_SYNC_ENABLED=true. Η προεπιλογή 0 2 * * * εκτελείται στις 02:00
  Europe/Athens, ξεκινά από το μεγαλύτερο αποθηκευμένο MARK και κάνει έως τρεις προσπάθειες.
  Σε production απαιτείται ταυτόχρονα AADE_MYDATA_PRODUCTION_READ_ENABLED=true.
- Το nightly sync είναι μόνο ανάγνωση. Δεν εγκρίνει ούτε αποστέλλει χαρακτηρισμούς.
- Κάθε production SendExpensesClassification απαιτεί φρέσκια προεπισκόπηση και ρητή
  έγκριση accountant/admin. Η έγκριση καταναλώνεται μετά από επιτυχημένη αποστολή και
  νέα προεπισκόπηση ακυρώνει προηγούμενη έγκριση.
- Ποτέ δεν καταγράφουμε subscription keys, JWT secrets ή TAXISnet credentials σε ticket, Git,
  screenshot ή restore-drill report.

## 4. Τι καλύπτουν τα backups

Τα scheduled services δημιουργούν δύο ανεξάρτητα artifacts:

- `open-logistirio-YYYYMMDD-HHMMSS.sql`: συνεπές MySQL dump.
- `open-logistirio-files-YYYYMMDD-HHMMSS.tar.gz`: supporting-document uploads.

Κάθε artifact γράφεται πρώτα ως `.partial`, δημοσιεύεται μόνο αφού ολοκληρωθεί και συνοδεύεται από
`.sha256`. Η προεπιλεγμένη συχνότητα είναι ημερήσια και η τοπική διατήρηση 30 ημέρες.

Το named volume `backup-data` δεν αποτελεί off-site backup. Αν χαθεί ο server/δίσκος, χάνεται και
αυτό. Αντιγράφουμε καθημερινά τα ολοκληρωμένα artifacts και τα `.sha256` σε ανεξάρτητο,
κρυπτογραφημένο και versioned storage. Ο εξωτερικός προορισμός πρέπει να έχει ξεχωριστά credentials
και retention policy.

## 5. Restore drill

Το drill δεν αγγίζει την production MySQL. Δημιουργεί προσωρινή MySQL σε `tmpfs`, επαναφέρει το
τελευταίο κανονικό dump, τρέχει SQL `CHECK TABLE`, ελέγχει κρίσιμους πίνακες και migrations και στη
συνέχεια επαληθεύει checksum και αναγνωσιμότητα του τελευταίου supporting-documents archive.

```sh
PRODUCTION_ENV_FILE=.env.production ./scripts/production-restore-drill.sh
```

Τα αποτελέσματα γράφονται στο αγνοούμενο από Git `restore-drills/`. Εκτελούμε drill:

- μετά την πρώτη εγκατάσταση,
- μετά από αλλαγή MySQL/Prisma migration ή backup διαδικασίας,
- τουλάχιστον μία φορά τον μήνα,
- πριν βασιστούμε σε backup για πραγματική επαναφορά.

Ένα drill θεωρείται επιτυχές μόνο όταν περάσουν και η βάση και το archive δικαιολογητικών.

## 6. Πραγματική επαναφορά

1. Δηλώνουμε incident και σταματάμε νέες καταχωρίσεις.
2. Επιβεβαιώνουμε ποιο backup επιλέχθηκε, timestamp και SHA-256.
3. Τρέχουμε πρώτα isolated restore drill με το ίδιο artifact.
4. Παίρνουμε νέο safety backup της τρέχουσας κατάστασης.
5. Κάνουμε database restore από admin UI ή ελεγχόμενο CLI.
6. Επαναφέρουμε το αντίστοιχο supporting-documents archive στο volume.
7. Τρέχουμε migrations, readiness/smoke checks και λογιστικό spot-check ανά πελάτη.
8. Καταγράφουμε ποιος ενέκρινε την επαναφορά, ποιο artifact χρησιμοποιήθηκε και το αποτέλεσμα.

Η επαναφορά supporting documents σε πραγματικό volume δεν αυτοματοποιείται από το drill, επειδή
είναι καταστροφική ενέργεια και απαιτεί συγκεκριμένο incident approval.

## 7. Rotation και ενημερώσεις

- Αλλάζουμε άμεσα secret που έχει διαρρεύσει και ανακαλούμε το παλιό όπου υποστηρίζεται.
- Προγραμματισμένη rotation γίνεται με backup πριν την αλλαγή και smoke check μετά το restart.
- Πριν από application update: επιτυχημένο backup, επιτυχημένο πρόσφατο drill και έλεγχος migration.
- Μετά το update: readiness, login, read-only myDATA sync και βασικό λογιστικό spot-check. Δεν
  χρησιμοποιούμε production AADE write ως smoke test.

## 8. Μηνιαίος operational έλεγχος

- Τελευταίο DB και files backup εντός της αναμενόμενης περιόδου.
- Και τα δύο checksums περνούν.
- Υπάρχει επιτυχημένο off-site replication.
- Το restore drill του μήνα έχει `PASSED` report.
- Δεν υπάρχουν unhealthy/restarting containers ή χαμηλός διαθέσιμος χώρος.
- Τα production-write flags της ΑΑΔΕ παραμένουν στην εγκεκριμένη κατάσταση.
