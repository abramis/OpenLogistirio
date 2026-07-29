# Changelog

## Unreleased

## 0.2.0 - 2026-07-29

- Added production payroll calculations for night work, Sundays/holidays,
  extra work, legal/approved/illegal overtime and part-time additional work,
  including separate contractual/statutory hourly bases.
- Separated gross pay from the social-insurance contribution basis and excluded
  the statutory premiums for full-time employees under the 2025 contribution rules.
- Added maternity, nine-month special maternity protection, paid paternity and
  parental-leave workflows with payer, employee request, external-benefit
  references, ERGANI E.14 protocol and automatic payroll-period impact.
- Added the production monthly withholding-tax workflow outside payroll for
  business-activity fees, dividends, interest and royalties.
- Added separate initial/amending returns, beneficiary detail, standard-rate
  calculations, treaty/special-rate overrides, Digital Transaction Fee fields,
  accountant approval and late submission/payment tracking.
- Added an AADE 2026 `JL10` fixed-width export in ISO-8859-7, packaged as the
  single-entry ZIP required by the official upload service.
- Added mandatory recording of the uploaded-file protocol, declaration
  reference, official payable amount, debt ID and payment reference.
- Completed the production periodic-VAT workflow with initial/amending revisions,
  editable statutory deadlines, payable/credit/refund outcomes, official submission
  reference, debt ID and one- or two-installment payment tracking.
- Added stale-workpaper protection when ERP or myDATA amounts change after approval.
- Added a separate supplier-credit-note type across documents, imports, accounting
  posting, VAT books/reports, period close and incoming myDATA `5.x` creation.
- Added a production annual income-tax close for independent accounting offices:
  E1/E2/E3/N tracking, initial and amending revisions, book/myDATA comparison,
  tax-adjustment workpaper, mandatory review gates and accountant approval.
- Added recording of the real myAADE submission reference, assessment, debt ID,
  assessed amounts and installment payments with late-submission/payment flags.
- Added protection against approving or submitting a stale annual workpaper after
  the underlying books or myDATA data changed.

- Promoted the Windows accounting-office installation from release candidate to the stable
  `0.2.0` production release.
- Added first-install and post-install Windows prompts for AADE Registry and myDATA production
  credentials, with hidden secret input, current-user-only file permissions and automatic API
  reload.
- Added a safe importer for existing AADE env files without copying unrelated infrastructure
  secrets into the Windows installation.
- Changed new Windows installs from misleading test mode to locked production mode and made the UI
  distinguish unconfigured, locked, read-only and write-enabled AADE states.
- Added production ΕΡΓΑΝΗ ΙΙ workflows for hiring and employment-relationship changes, including
  legal deadlines, actual submission protocol, employee-acceptance evidence and late-submission
  tracking.
- Blocked payroll calculation and approval when a due ΕΡΓΑΝΗ ΙΙ declaration remains pending,
  without prematurely blocking statutory/collective-agreement pay changes during their 30-day
  submission window.
- Added safe cancellation of an unsubmitted new contract and its draft hiring declaration.
- Added weekly work schedules, break placement, Digital Work Card participation and flexible
  arrival to payroll contracts, plus an automatically tracked same-day initial Digital Work-Time
  Organization declaration for every new hiring.
- Added production tracking for APD submission, e-EFKA contribution payment and monthly FMY
  declaration/payment, including official references, editable deadlines and late-action flags.
- Added separate TEKA enrollment, APD protocol, contribution amount and payment tracking instead
  of combining TEKA obligations with e-EFKA.

## 0.2.0-rc.8 - 2026-07-19

- Fixed the initial-setup page remaining on its loading spinner after the public status request
  completed under Angular's zoneless renderer.
- Prevented the authenticated application shell from being created during first-run routing or
  requesting protected myDATA metadata before a user session exists.
- Added browser-level and zoneless regression coverage for the Windows first-run setup flow.

## 0.2.0-rc.7 - 2026-07-19

- Fixed the first Windows installation incorrectly aborting when its Docker data volume did not
  exist yet.
- Added a Windows PowerShell regression test for both missing and existing Docker volumes and made
  the installer test server shut down reliably.

## 0.2.0-rc.6 - 2026-07-19

- Added a double-click Windows production installer with generated infrastructure secrets,
  loopback-only access, stable Docker volumes and automatic browser launch.
- Added a one-time browser form for the accounting-office details and first administrator; fresh
  production installations contain no demo users, clients or documents.
- Reorganized the documentation so normal Windows use is first and Linux/development workflows
  are clearly separated.
- Added clean production installation, backup/restore, restart and cross-directory persistence
  checks before publishing images, plus a downloadable Windows release ZIP.
- Fixed MySQL 8.4 backup and restore compatibility in the non-root API container and added a
  pre-update database backup path.

## 0.2.0-rc.5 - 2026-07-18

- Made clean CI/release installs generate the Prisma client explicitly before migrations and tests.
- Added structured Jest diagnostics and reliable handling of successful test results in CI.

## 0.2.0-rc.4 - 2026-07-18

- Added the required XML validator to CI/release runners; all 120 API tests now pass in a clean
  Node 22 container without a local `.env` file.

## 0.2.0-rc.3 - 2026-07-18

- Fixed the tax-calendar table collation so all 30 migrations apply successfully to a clean
  MySQL 8.4 database.

## 0.2.0-rc.2 - 2026-07-18

- Fixed CI and release migrations so they use the injected service database instead of loading
  local-development `.env` values.

## 0.2.0-rc.1 - 2026-07-18

First production-pilot release candidate for Greek accounting offices.

### Added

- Controlled incoming myDATA purchase-document creation and expense-classification approvals.
- Scheduled incremental myDATA synchronization, retries and office review indicators.
- Period-close, VAT workpapers, year-end entries, supporting documents and audit trails.
- CSV/XLSX imports with preview, duplicate detection, rollback and row-level errors.
- Production bootstrap for the first accounting-office administrator.
- Production backup, restore-drill, health, build metadata and release automation.

### Changed

- Refined the application-wide accounting-office UI structure and neutral visual theme.
- Production AADE writes remain disabled by default and require explicit user approval.
- Production dependencies are pinned and Docker runtime images exclude build tooling.

### Known limitations

- Payroll, APD, ERGANI and official declaration submission are not included.
- Stable production status still requires Greek-accountant UAT and the remaining real AADE test E2E.
