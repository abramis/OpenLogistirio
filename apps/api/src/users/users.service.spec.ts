import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { UsersService } from './users.service';

const tenant: TenantContext = {
  accountingOfficeId: 'office-1',
  userId: 'admin-1',
};

describe('UsersService', () => {
  let prisma: {
    user: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let service: UsersService;

  beforeEach(() => {
    prisma = {
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new UsersService(prisma as unknown as PrismaService);
  });

  it('lists users only for the current accounting office', async () => {
    prisma.user.findMany.mockResolvedValue([]);

    await service.findAll(tenant);

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { accountingOfficeId: 'office-1' },
      select: expect.objectContaining({
        id: true,
        email: true,
        fullName: true,
        role: true,
      }),
      orderBy: [{ fullName: 'asc' }, { email: 'asc' }],
    });
    expect(prisma.user.findMany.mock.calls[0][0].select).not.toHaveProperty('passwordHash');
  });

  it('creates an office user with a hashed password', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'accountant@example.gr',
      fullName: 'Accountant',
      role: UserRole.ACCOUNTANT,
    });

    await service.create(tenant, {
      email: 'Accountant@Example.gr',
      fullName: 'Accountant',
      role: UserRole.ACCOUNTANT,
      password: 'ChangeMe123!',
    });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountingOfficeId: 'office-1',
        email: 'accountant@example.gr',
        fullName: 'Accountant',
        role: UserRole.ACCOUNTANT,
        passwordHash: expect.any(String),
      }),
      select: expect.any(Object),
    });
  });

  it('does not create duplicate email users', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

    await expect(
      service.create(tenant, {
        email: 'accountant@example.gr',
        fullName: 'Accountant',
        role: UserRole.ACCOUNTANT,
        password: 'ChangeMe123!',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates users only inside the current accounting office', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.update(tenant, 'other-office-user', { role: UserRole.ASSISTANT }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
