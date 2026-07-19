# Changelog

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
