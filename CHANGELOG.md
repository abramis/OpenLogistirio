# Changelog

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
