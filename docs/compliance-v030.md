# Compliance workflows in v0.3.0

## Annual AADE certificates

The annual-certificate workspace generates separate revisions for employment income,
business-activity fees and dividends/interest/royalties. A revision cannot become ready
while payroll or monthly-withholding submissions are missing or its book/source totals do
not reconcile. File generation records a SHA-256 checksum; submission requires the real
myAADE protocol and timestamp, after which the revision can be locked or superseded by an
amending revision.

The included fixed-width exporter is deliberately restricted to fiscal year 2025. The
official layout changes by decision/year, so a later year is blocked until its published
AADE layout is implemented and tested. Sources: [AADE A.1195/2025](https://www.aade.gr/egkyklioi-kai-apofaseis/1195-24-12-2025)
and the [official annual-certificate upload page](https://aade.gr/ypoboli-bebaiosis-apodohon-i-syntaxeon-amoibon).

## VIES and Intrastat

Applicability is enabled per client. VIES creates F4/F5 workpapers from the books, compares
them with myDATA, validates EU VAT numbers through the European Commission service and emits
the official XML structure. Intrastat stores thresholds by year, separately evaluates
arrivals and dispatches, and emits the official 87-character ELSTAT record. Both workflows
support protocol recording, amendments and locking.

The seeded Intrastat thresholds are 2025 (arrivals EUR 200,000; dispatches EUR 90,000) and
2026 (arrivals EUR 250,000; dispatches EUR 90,000). A missing year is a blocker and must be
added from the official annual ELSTAT announcement.

## Special collective agreements

The registry is versioned by validity dates and keeps its official source URL. Matching uses
client KAD, specialty and priority/mandatory status. Applying an evaluated version writes a
legal-base snapshot to the payroll contract; it never silently invents an agreement or rate.
The source of truth remains the [Ministry of Labour collective-agreement registry](https://ypergasias.gov.gr/ergasiakes-scheseis/syllogikes-ergasiakes-sxeseis/).

## AADE digital movement

Enable the feature only for clients that fall within the applicable AADE phase. The dispatch
workflow sends invoice type 9.3 through `SendInvoices`, validates the payload against the
bundled official myDATA XSD v2.0.1 and stores MARK, UID and QR. It also exposes the official
transfer registration, delivery outcome, rejection, cancellation and status operations.
Local issue/completion/cancellation is blocked until the corresponding AADE action succeeds.
Production writes remain protected by `AADE_MYDATA_PRODUCTION_ENABLED`.

## Encrypted off-site backup on Windows

1. Run `INSTALL-WINDOWS.cmd` normally.
2. Run `CONFIGURE-OFFSITE-BACKUP-WINDOWS.cmd` and enter a restic repository. S3/Backblaze,
   SFTP and REST repositories are supported by restic.
3. For S3-compatible storage, enter the access key, secret and region. The independent restic
   encryption password is generated locally and never stored in the repository.
4. The service uploads database dumps and supporting-document archives every day and retains
   14 daily, 8 weekly and 12 monthly snapshots by default. Set a webhook to receive failures.
5. The configurator creates a Sunday 03:30 Windows Scheduled Task. It downloads the latest
   remote snapshot, verifies checksums and the documents archive, restores the SQL into an
   isolated MySQL container and writes `restore-drills/offsite-restore-drill-*.txt`.
6. Run `RUN-BACKUP-DRILL-WINDOWS.cmd` at any time for an immediate drill.

Keep an offline copy of the generated restic password. Without it, encrypted off-site
snapshots cannot be recovered.
