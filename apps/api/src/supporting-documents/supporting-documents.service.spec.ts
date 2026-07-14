import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaService } from '../common/prisma/prisma.service';
import { SupportingDocumentsService } from './supporting-documents.service';

const tenant = { accountingOfficeId: 'office-1' };

describe('SupportingDocumentsService', () => {
  let storageDirectory = '';

  afterEach(async () => {
    if (storageDirectory) await rm(storageDirectory, { recursive: true, force: true });
    storageDirectory = '';
  });

  it('stores an allowed file and returns a tenant-scoped download path', async () => {
    storageDirectory = await mkdtemp(join(tmpdir(), 'open-logistirio-supporting-'));
    const prisma = {
      clientCompany: { findFirst: jest.fn().mockResolvedValue({ id: 'company-1' }) },
      supportingDocument: {
        create: jest.fn(({ data }) => Promise.resolve({ id: 'file-1', ...data })),
      },
    };
    const service = new SupportingDocumentsService(
      prisma as unknown as PrismaService,
      new ConfigService({ SUPPORTING_DOCUMENTS_DIR: storageDirectory }),
    );

    const result = await service.upload(tenant, 'company-1', {
      originalname: 'proof.pdf',
      mimetype: 'application/pdf',
      size: 4,
      buffer: Buffer.from('test'),
    });

    const stored = prisma.supportingDocument.create.mock.calls[0][0].data;
    expect(result).toEqual(
      expect.objectContaining({ id: 'file-1', name: 'proof.pdf', downloadPath: '/supporting-documents/file-1/download' }),
    );
    await expect(readFile(join(storageDirectory, stored.storageKey), 'utf8')).resolves.toBe('test');
  });

  it('rejects disallowed extensions before writing a file', async () => {
    storageDirectory = await mkdtemp(join(tmpdir(), 'open-logistirio-supporting-'));
    const prisma = {
      clientCompany: { findFirst: jest.fn().mockResolvedValue({ id: 'company-1' }) },
      supportingDocument: { create: jest.fn() },
    };
    const service = new SupportingDocumentsService(
      prisma as unknown as PrismaService,
      new ConfigService({ SUPPORTING_DOCUMENTS_DIR: storageDirectory }),
    );

    await expect(
      service.upload(tenant, 'company-1', {
        originalname: 'unsafe.exe',
        mimetype: 'application/octet-stream',
        size: 4,
        buffer: Buffer.from('test'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.supportingDocument.create).not.toHaveBeenCalled();
  });
});
