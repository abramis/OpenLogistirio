import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { BackupService, buildMySqlDumpArgs } from './backup.service';

describe('BackupService', () => {
  let backupDir: string;
  let service: BackupService;
  const tenant = {} as TenantContext;

  beforeEach(async () => {
    backupDir = await mkdtemp(join(tmpdir(), 'open-logistirio-backups-'));
    const config = {
      get: jest.fn((key: string, fallback: string) =>
        key === 'BACKUP_DIR' ? backupDir : fallback,
      ),
      getOrThrow: jest.fn(() => 'mysql://user:password@localhost:3306/open_logistirio'),
    } as unknown as ConfigService;
    const audit = { record: jest.fn() } as unknown as AuditService;
    service = new BackupService(config, audit);
  });

  afterEach(async () => {
    await rm(backupDir, { recursive: true, force: true });
  });

  it('lists a backup together with its stored SHA-256 checksum', async () => {
    const fileName = 'open-logistirio-20260718-120000.sql';
    const content = 'CREATE TABLE sample (id INT);\n';
    const checksum = createHash('sha256').update(content).digest('hex');
    await writeFile(join(backupDir, fileName), content);
    await writeFile(join(backupDir, `${fileName}.sha256`), `${checksum}  ${fileName}\n`);

    await expect(service.list()).resolves.toEqual([
      expect.objectContaining({ fileName, checksumSha256: checksum }),
    ]);
  });

  it('keeps old backups visible as legacy when no checksum exists', async () => {
    const fileName = 'open-logistirio-20260718-120001.sql';
    await writeFile(join(backupDir, fileName), 'legacy dump');

    await expect(service.list()).resolves.toEqual([
      expect.objectContaining({ fileName, checksumSha256: null }),
    ]);
  });

  it('reports healthy coverage only when database and supporting files are protected', async () => {
    const databaseFile = 'open-logistirio-20260718-120010.sql';
    const filesArchive = 'open-logistirio-files-20260718-120010.tar.gz';
    await writeFile(join(backupDir, databaseFile), 'database dump');
    await writeFile(join(backupDir, filesArchive), 'files archive');
    await writeFile(
      join(backupDir, `${databaseFile}.sha256`),
      `${'a'.repeat(64)}  ${databaseFile}\n`,
    );
    await writeFile(
      join(backupDir, `${filesArchive}.sha256`),
      `${'b'.repeat(64)}  ${filesArchive}\n`,
    );

    await expect(service.operationsStatus()).resolves.toEqual(
      expect.objectContaining({
        healthy: true,
        database: expect.objectContaining({ fileName: databaseFile, fresh: true }),
        supportingDocuments: expect.objectContaining({ fileName: filesArchive, fresh: true }),
      }),
    );
  });

  it('reports incomplete coverage when the supporting-documents archive is missing', async () => {
    const databaseFile = 'open-logistirio-20260718-120011.sql';
    await writeFile(join(backupDir, databaseFile), 'database dump');
    await writeFile(
      join(backupDir, `${databaseFile}.sha256`),
      `${'a'.repeat(64)}  ${databaseFile}\n`,
    );

    const status = await service.operationsStatus();
    expect(status.healthy).toBe(false);
    expect(status.supportingDocuments.fileName).toBeNull();
  });

  it('rejects a corrupted backup before restore creates a safety backup', async () => {
    const fileName = 'open-logistirio-20260718-120002.sql';
    await writeFile(join(backupDir, fileName), 'tampered dump');
    await writeFile(join(backupDir, `${fileName}.sha256`), `${'0'.repeat(64)}  ${fileName}\n`);

    await expect(service.restore(tenant, fileName)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('verifies a valid checksum before returning a download stream', async () => {
    const fileName = 'open-logistirio-20260718-120003.sql';
    const content = 'verified dump';
    const checksum = createHash('sha256').update(content).digest('hex');
    await writeFile(join(backupDir, fileName), content);
    await writeFile(join(backupDir, `${fileName}.sha256`), `${checksum}  ${fileName}\n`);

    const download = await service.resolveDownload(fileName);
    expect(download.checksumSha256).toBe(checksum);
    download.stream.destroy();
  });
});

describe('buildMySqlDumpArgs', () => {
  it('avoids global MySQL privileges that the application user does not have', () => {
    const args = buildMySqlDumpArgs({
      host: 'mysql',
      port: '3306',
      user: 'openlog',
      password: 'secret',
      database: 'open_logistirio',
    });

    expect(args).toContain('--no-tablespaces');
    expect(args).toContain('--skip-ssl-verify-server-cert');
    expect(args).not.toContain('--routines');
    expect(args).not.toContain('--events');
  });
});
