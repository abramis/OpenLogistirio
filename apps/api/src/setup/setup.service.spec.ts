import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { SetupService, validateInitialPassword } from './setup.service';

const setupToken = 'a'.repeat(48);

describe('SetupService', () => {
  it('reports whether the first-run form is required and available', async () => {
    const prisma = { user: { count: jest.fn().mockResolvedValue(0) } } as unknown as PrismaService;
    const service = createService(prisma);

    await expect(service.status()).resolves.toEqual({ required: true, available: true });
  });

  it('rejects an invalid setup token', async () => {
    const prisma = { user: { count: jest.fn() } } as unknown as PrismaService;
    const service = createService(prisma);

    await expect(service.initialize(dto({ setupToken: 'b'.repeat(48) }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.user.count).not.toHaveBeenCalled();
  });

  it('creates the office with all contact details and the first administrator', async () => {
    const tx = {
      user: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'owner@example.gr',
          role: 'ACCOUNTING_OFFICE_ADMIN',
        }),
      },
      accountingOffice: {
        create: jest.fn().mockResolvedValue({
          id: 'open-logistirio-initial-office',
          name: 'Office',
        }),
      },
    };
    const prisma = {
      user: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = createService(prisma);

    await expect(service.initialize(dto())).resolves.toMatchObject({
      office: { id: 'open-logistirio-initial-office', name: 'Office' },
      user: { email: 'owner@example.gr' },
    });
    expect(tx.accountingOffice.create).toHaveBeenCalledWith({
      data: {
        id: 'open-logistirio-initial-office',
        name: 'Office',
        vatNumber: '123456789',
        email: 'office@example.gr',
        phone: '2101234567',
        address: 'Athens',
      },
    });
    expect(tx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountingOfficeId: 'open-logistirio-initial-office',
        email: 'owner@example.gr',
        fullName: 'Owner',
        role: 'ACCOUNTING_OFFICE_ADMIN',
        passwordHash: expect.not.stringContaining('Very-Strong-Key-2026!'),
      }),
      select: { id: true, email: true, role: true },
    });
  });

  it('refuses setup after any user exists', async () => {
    const prisma = { user: { count: jest.fn().mockResolvedValue(1) } } as unknown as PrismaService;
    const service = createService(prisma);

    await expect(service.initialize(dto())).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('initial setup password policy', () => {
  it('requires all character classes', () => {
    expect(() => validateInitialPassword('onlylowercase123!')).toThrow(BadRequestException);
  });

  it('rejects default-password patterns', () => {
    expect(() => validateInitialPassword('ChangeMe-Secure-2026!')).toThrow(BadRequestException);
  });
});

function createService(prisma: PrismaService): SetupService {
  const config = { get: jest.fn().mockReturnValue(setupToken) } as unknown as ConfigService;
  return new SetupService(prisma, config);
}

function dto(overrides: Partial<Parameters<SetupService['initialize']>[0]> = {}) {
  return {
    officeName: 'Office',
    officeVatNumber: '123456789',
    officeEmail: 'office@example.gr',
    officePhone: '2101234567',
    officeAddress: 'Athens',
    adminFullName: 'Owner',
    adminEmail: 'owner@example.gr',
    adminPassword: 'Very-Strong-Key-2026!',
    setupToken,
    ...overrides,
  };
}
