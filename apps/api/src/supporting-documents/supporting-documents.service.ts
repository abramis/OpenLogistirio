import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'node:fs';
import { access, mkdir, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { extname, resolve } from 'node:path';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';

export type UploadedSupportingFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const ALLOWED_FILE_TYPES: Record<string, ReadonlySet<string>> = {
  '.pdf': new Set(['application/pdf']),
  '.png': new Set(['image/png']),
  '.jpg': new Set(['image/jpeg']),
  '.jpeg': new Set(['image/jpeg']),
  '.webp': new Set(['image/webp']),
  '.csv': new Set(['text/csv', 'application/csv', 'text/plain']),
  '.xlsx': new Set([
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream',
  ]),
};

@Injectable()
export class SupportingDocumentsService {
  private readonly storageDirectory: string;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.storageDirectory = resolve(
      process.cwd(),
      configService.get<string>('SUPPORTING_DOCUMENTS_DIR', 'storage/supporting-documents'),
    );
  }

  async upload(tenant: TenantContext, clientCompanyId: string, file: UploadedSupportingFile) {
    await this.ensureTenantCompany(tenant, clientCompanyId);
    const extension = extname(file.originalname).toLowerCase();
    const allowedMimeTypes = ALLOWED_FILE_TYPES[extension];
    if (!allowedMimeTypes || !allowedMimeTypes.has(file.mimetype)) {
      throw new BadRequestException('Unsupported supporting-document file type.');
    }
    if (!file.buffer?.length || file.size !== file.buffer.length) {
      throw new BadRequestException('Uploaded supporting document is empty or invalid.');
    }

    const storageKey = `${randomUUID()}${extension}`;
    const filePath = this.filePath(storageKey);
    await mkdir(this.storageDirectory, { recursive: true });
    await writeFile(filePath, file.buffer, { flag: 'wx' });

    try {
      const attachment = await this.prisma.supportingDocument.create({
        data: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId,
          originalName: safeFileName(file.originalname),
          storageKey,
          contentType: file.mimetype,
          sizeBytes: file.size,
        },
      });
      return {
        id: attachment.id,
        name: attachment.originalName,
        contentType: attachment.contentType,
        sizeBytes: attachment.sizeBytes,
        downloadPath: `/supporting-documents/${attachment.id}/download`,
      };
    } catch (error) {
      await unlink(filePath).catch(() => undefined);
      throw error;
    }
  }

  async download(tenant: TenantContext, id: string) {
    const attachment = await this.prisma.supportingDocument.findFirst({
      where: { id, accountingOfficeId: tenant.accountingOfficeId },
    });
    if (!attachment) {
      throw new NotFoundException('Supporting document was not found.');
    }
    const filePath = this.filePath(attachment.storageKey);
    try {
      await access(filePath);
    } catch {
      throw new NotFoundException('Supporting document storage file was not found.');
    }
    return { attachment, stream: createReadStream(filePath) };
  }

  private async ensureTenantCompany(tenant: TenantContext, clientCompanyId: string) {
    const company = await this.prisma.clientCompany.findFirst({
      where: {
        id: clientCompanyId,
        accountingOfficeId: tenant.accountingOfficeId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!company) {
      throw new NotFoundException('Client company was not found.');
    }
  }

  private filePath(storageKey: string): string {
    return resolve(this.storageDirectory, storageKey);
  }
}

function safeFileName(name: string): string {
  const normalized = name.replace(/[\\/\0]/g, '_').trim();
  return (normalized || 'supporting-document').slice(0, 255);
}
