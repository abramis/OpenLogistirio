import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { link, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { finished } from 'node:stream/promises';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/tenant/tenant-context';

export interface BackupFileInfo {
  fileName: string;
  sizeBytes: number;
  createdAt: Date;
  checksumSha256: string | null;
}

export interface BackupArtifactStatus {
  fileName: string | null;
  sizeBytes: number;
  createdAt: Date | null;
  ageHours: number | null;
  checksumAvailable: boolean;
  fresh: boolean;
}

export interface BackupOperationsStatus {
  healthy: boolean;
  maxAgeHours: number;
  database: BackupArtifactStatus;
  supportingDocuments: BackupArtifactStatus;
}

@Injectable()
export class BackupService {
  private readonly backupDir: string;
  private readonly maxAgeHours: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {
    this.backupDir = resolve(this.configService.get<string>('BACKUP_DIR', './backups'));
    this.maxAgeHours = this.configService.get<number>('BACKUP_MAX_AGE_HOURS', 36);
  }

  async operationsStatus(): Promise<BackupOperationsStatus> {
    await mkdir(this.backupDir, { recursive: true });
    const entries = await readdir(this.backupDir);
    const database = await this.latestArtifactStatus(
      entries.filter(
        (fileName) => isSafeBackupFileName(fileName) && !fileName.includes('-pre-restore'),
      ),
    );
    const supportingDocuments = await this.latestArtifactStatus(
      entries.filter((fileName) => isSafeSupportingDocumentsArchive(fileName)),
    );

    return {
      healthy:
        database.fresh &&
        database.checksumAvailable &&
        supportingDocuments.fresh &&
        supportingDocuments.checksumAvailable,
      maxAgeHours: this.maxAgeHours,
      database,
      supportingDocuments,
    };
  }

  async list(): Promise<BackupFileInfo[]> {
    await mkdir(this.backupDir, { recursive: true });
    const entries = await readdir(this.backupDir);
    const backups = await Promise.all(
      entries
        .filter((fileName) => isSafeBackupFileName(fileName))
        .map(async (fileName) => {
          const fileStat = await stat(this.resolveBackupPath(fileName));
          return {
            fileName,
            sizeBytes: fileStat.size,
            createdAt: fileStat.birthtime,
            checksumSha256: await this.readChecksum(fileName),
          };
        }),
    );

    return backups.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  async create(tenant: TenantContext, label = ''): Promise<BackupFileInfo> {
    await mkdir(this.backupDir, { recursive: true });
    const database = this.getDatabaseConnection();
    const fileName = `open-logistirio-${timestamp()}${label}.sql`;
    const filePath = this.resolveBackupPath(fileName);
    const partialPath = `${filePath}.partial-${randomUUID()}`;

    try {
      await runDump(database, partialPath);
      const partialStat = await stat(partialPath);
      if (partialStat.size === 0) {
        throw new Error('Database dump is empty.');
      }
      await link(partialPath, filePath);
      await rm(partialPath);
    } catch (error) {
      await rm(partialPath, { force: true });
      throw error;
    }

    const fileStat = await stat(filePath);
    const checksumSha256 = await calculateSha256(filePath);
    await this.writeChecksum(fileName, checksumSha256);
    await this.auditService.record({
      tenant,
      action: AuditAction.CREATE,
      entityType: 'Backup',
      entityId: fileName,
      newValue: {
        fileName,
        sizeBytes: fileStat.size,
        checksumSha256,
      },
    });

    return {
      fileName,
      sizeBytes: fileStat.size,
      createdAt: fileStat.birthtime,
      checksumSha256,
    };
  }

  async restore(tenant: TenantContext, fileName: string) {
    const safeFileName = this.assertSafeBackupFileName(fileName);
    const filePath = this.resolveBackupPath(safeFileName);

    try {
      await stat(filePath);
    } catch {
      throw new NotFoundException('Backup file was not found.');
    }

    await this.assertChecksumMatches(safeFileName);

    const safetyBackup = await this.create(tenant, '-pre-restore');
    const database = this.getDatabaseConnection();
    await runRestore(database, filePath);

    await this.auditService.record({
      tenant,
      action: AuditAction.UPDATE,
      entityType: 'BackupRestore',
      entityId: safeFileName,
      newValue: {
        restoredFrom: safeFileName,
        safetyBackup: safetyBackup.fileName,
      },
    });

    return {
      restored: true,
      restoredFrom: safeFileName,
      safetyBackup,
    };
  }

  async resolveDownload(fileName: string) {
    const safeFileName = this.assertSafeBackupFileName(fileName);
    const filePath = this.resolveBackupPath(safeFileName);

    try {
      await stat(filePath);
    } catch {
      throw new NotFoundException('Backup file was not found.');
    }

    await this.assertChecksumMatches(safeFileName);

    const checksumSha256 = await this.readChecksum(safeFileName);

    return {
      fileName: safeFileName,
      filePath,
      checksumSha256,
      stream: createReadStream(filePath),
    };
  }

  private getDatabaseConnection() {
    const databaseUrl = this.configService.getOrThrow<string>('DATABASE_URL');
    const url = new URL(databaseUrl);

    if (!['mysql:', 'mariadb:'].includes(url.protocol)) {
      throw new BadRequestException('Backup/restore currently supports MySQL/MariaDB only.');
    }

    return {
      host: url.hostname,
      port: url.port || '3306',
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: basename(url.pathname),
    };
  }

  private assertSafeBackupFileName(fileName: string): string {
    if (!isSafeBackupFileName(fileName)) {
      throw new BadRequestException('Invalid backup file name.');
    }

    return fileName;
  }

  private resolveBackupPath(fileName: string): string {
    const filePath = resolve(join(this.backupDir, fileName));

    if (!filePath.startsWith(this.backupDir)) {
      throw new BadRequestException('Invalid backup file path.');
    }

    return filePath;
  }

  private checksumPath(fileName: string): string {
    return `${this.resolveBackupPath(fileName)}.sha256`;
  }

  private async readChecksum(fileName: string): Promise<string | null> {
    try {
      const content = await readFile(this.checksumPath(fileName), 'utf8');
      const checksum = content.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
      return /^[a-f0-9]{64}$/.test(checksum) ? checksum : null;
    } catch {
      return null;
    }
  }

  private async writeChecksum(fileName: string, checksum: string): Promise<void> {
    const checksumPath = this.checksumPath(fileName);
    const partialPath = `${checksumPath}.partial-${process.pid}`;
    await writeFile(partialPath, `${checksum}  ${fileName}\n`, { encoding: 'utf8', flag: 'wx' });
    await rename(partialPath, checksumPath);
  }

  private async assertChecksumMatches(fileName: string): Promise<void> {
    const expected = await this.readChecksum(fileName);
    if (!expected) {
      return;
    }

    const actual = await calculateSha256(this.resolveBackupPath(fileName));
    if (actual !== expected) {
      throw new BadRequestException(
        'Backup checksum verification failed. Restore was not started.',
      );
    }
  }

  private async latestArtifactStatus(fileNames: string[]): Promise<BackupArtifactStatus> {
    if (fileNames.length === 0) {
      return {
        fileName: null,
        sizeBytes: 0,
        createdAt: null,
        ageHours: null,
        checksumAvailable: false,
        fresh: false,
      };
    }

    const artifacts = await Promise.all(
      fileNames.map(async (fileName) => ({
        fileName,
        fileStat: await stat(this.resolveArtifactPath(fileName)),
      })),
    );
    artifacts.sort((left, right) => right.fileStat.mtimeMs - left.fileStat.mtimeMs);
    const latest = artifacts[0];
    const ageHours = (Date.now() - latest.fileStat.mtimeMs) / 3_600_000;

    return {
      fileName: latest.fileName,
      sizeBytes: latest.fileStat.size,
      createdAt: latest.fileStat.mtime,
      ageHours,
      checksumAvailable: Boolean(await this.readArtifactChecksum(latest.fileName)),
      fresh: ageHours <= this.maxAgeHours,
    };
  }

  private resolveArtifactPath(fileName: string): string {
    if (!isSafeBackupFileName(fileName) && !isSafeSupportingDocumentsArchive(fileName)) {
      throw new BadRequestException('Invalid backup artifact name.');
    }
    return resolve(join(this.backupDir, fileName));
  }

  private async readArtifactChecksum(fileName: string): Promise<string | null> {
    try {
      const content = await readFile(`${this.resolveArtifactPath(fileName)}.sha256`, 'utf8');
      const checksum = content.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
      return /^[a-f0-9]{64}$/.test(checksum) ? checksum : null;
    } catch {
      return null;
    }
  }
}

interface DatabaseConnection {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

async function runDump(database: DatabaseConnection, filePath: string): Promise<void> {
  const output = createWriteStream(filePath, { flags: 'wx' });
  const args = [
    '--host',
    database.host,
    '--port',
    database.port,
    '--user',
    database.user,
    '--single-transaction',
    '--quick',
    '--routines',
    '--triggers',
    '--events',
    database.database,
  ];

  try {
    await runProcess('mysqldump', args, {
      env: { MYSQL_PWD: database.password },
      stdout: output,
    });
    await finished(output);
  } catch (error) {
    output.destroy();
    throw error;
  }
}

async function runRestore(database: DatabaseConnection, filePath: string): Promise<void> {
  const input = createReadStream(filePath);
  const args = [
    '--host',
    database.host,
    '--port',
    database.port,
    '--user',
    database.user,
    database.database,
  ];

  await runProcess('mysql', args, {
    env: { MYSQL_PWD: database.password },
    stdin: input,
  });
}

function runProcess(
  command: string,
  args: string[],
  options: {
    env: Record<string, string>;
    stdin?: NodeJS.ReadableStream;
    stdout?: NodeJS.WritableStream;
  },
): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      env: {
        ...process.env,
        ...options.env,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stderr = '';

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => reject(error));
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(new Error(stderr || `${command} exited with code ${code}`));
    });

    if (options.stdin) {
      options.stdin.pipe(child.stdin);
    } else {
      child.stdin.end();
    }

    if (options.stdout) {
      child.stdout.pipe(options.stdout);
    }
  });
}

function timestamp(): string {
  const now = new Date();
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  return `${date}-${time}`;
}

async function calculateSha256(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  const input = createReadStream(filePath);
  input.on('data', (chunk: Buffer) => hash.update(chunk));
  await finished(input);
  return hash.digest('hex');
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function isSafeBackupFileName(fileName: string): boolean {
  return /^open-logistirio-\d{8}-\d{6}(?:-pre-restore)?\.sql$/.test(fileName);
}

function isSafeSupportingDocumentsArchive(fileName: string): boolean {
  return /^open-logistirio-files-\d{8}-\d{6}\.tar\.gz$/.test(fileName);
}
