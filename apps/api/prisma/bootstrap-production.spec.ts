import { PrismaClient, UserRole } from '@prisma/client';
import { bootstrapProduction, parseProductionBootstrapConfig } from './bootstrap-production';

describe('production bootstrap', () => {
  it('requires a strong non-default password', () => {
    expect(() =>
      parseProductionBootstrapConfig({
        BOOTSTRAP_OFFICE_NAME: 'Demo Office',
        BOOTSTRAP_ADMIN_EMAIL: 'admin@example.gr',
        BOOTSTRAP_ADMIN_FULL_NAME: 'Office Admin',
        BOOTSTRAP_ADMIN_PASSWORD: 'ChangeMe123!',
      }),
    ).toThrow('at least 14 characters');
  });

  it('creates the first office administrator atomically', async () => {
    const tx = {
      accountingOffice: {
        create: jest.fn().mockResolvedValue({ id: 'office-1', name: 'Office' }),
      },
      user: {
        create: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'owner@example.gr',
          role: UserRole.ACCOUNTING_OFFICE_ADMIN,
        }),
      },
    };
    const client = {
      user: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    const result = await bootstrapProduction(client, {
      officeName: 'Office',
      officeVatNumber: '123456789',
      adminEmail: 'owner@example.gr',
      adminFullName: 'Owner Name',
      adminPassword: 'Very-Strong-Password-2026!',
    });

    expect(result.created).toBe(true);
    expect(tx.accountingOffice.create).toHaveBeenCalledWith({
      data: { name: 'Office', vatNumber: '123456789' },
    });
    expect(tx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountingOfficeId: 'office-1',
        email: 'owner@example.gr',
        role: UserRole.ACCOUNTING_OFFICE_ADMIN,
        passwordHash: expect.not.stringContaining('Very-Strong-Password-2026!'),
      }),
      select: { id: true, email: true, role: true },
    });
  });

  it('refuses to initialize a database that already has unrelated users', async () => {
    const client = {
      user: {
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaClient;

    await expect(
      bootstrapProduction(client, {
        officeName: 'Office',
        adminEmail: 'owner@example.gr',
        adminFullName: 'Owner Name',
        adminPassword: 'Very-Strong-Password-2026!',
      }),
    ).rejects.toThrow('database already contains users');
  });
});
