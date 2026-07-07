import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthService } from './auth.service';

const user = {
  id: 'user-1',
  accountingOfficeId: 'office-1',
  email: 'admin@example.gr',
  passwordHash: bcrypt.hashSync('ChangeMe123!', 4),
  fullName: 'Demo Admin',
  role: UserRole.ACCOUNTING_OFFICE_ADMIN,
  disabledAt: null,
  failedLoginAttempts: 0,
  lockedUntil: null,
  passwordChangedAt: new Date('2026-01-01T00:00:00.000Z'),
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  accountingOffice: {
    id: 'office-1',
    name: 'Demo Office',
  },
};

describe('AuthService', () => {
  let prisma: {
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    refreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    passwordResetToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let jwtService: {
    signAsync: jest.Mock;
    verifyAsync: jest.Mock;
  };
  let configService: {
    get: jest.Mock;
    getOrThrow: jest.Mock;
  };
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      refreshToken: {
        create: jest.fn().mockResolvedValue({ id: 'refresh-row-1' }),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      passwordResetToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((operations: unknown[]) => Promise.all(operations)),
    };
    jwtService = {
      signAsync: jest.fn((payload: { sub: string }, options: { secret?: string; jwtid?: string }) =>
        Promise.resolve(
          options.secret === 'refresh-secret'
            ? jwtWithExpiry(payload.sub, options.jwtid ?? 'refresh-jti')
            : `access-token:${payload.sub}`,
        ),
      ),
      verifyAsync: jest.fn(),
    };
    configService = {
      get: jest.fn().mockReturnValue('test'),
      getOrThrow: jest.fn((key: string) => {
        const values: Record<string, string> = {
          JWT_ACCESS_SECRET: 'access-secret',
          JWT_REFRESH_SECRET: 'refresh-secret',
          JWT_ACCESS_EXPIRES_IN: '15m',
          JWT_REFRESH_EXPIRES_IN: '7d',
        };
        return values[key];
      }),
    };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
    );
  });

  it('issues access and refresh tokens for valid credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(user);

    const result = await service.login('admin@example.gr', 'ChangeMe123!');

    expect(result).toEqual(
      expect.objectContaining({
        accessToken: 'access-token:user-1',
        refreshToken: expect.any(String),
        user: {
          id: 'user-1',
          email: 'admin@example.gr',
          fullName: 'Demo Admin',
          role: UserRole.ACCOUNTING_OFFICE_ADMIN,
          accountingOffice: {
            id: 'office-1',
            name: 'Demo Office',
          },
        },
      }),
    );
    expect(result).not.toHaveProperty('refreshTokenId');
    expect(prisma.refreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        jwtId: expect.any(String),
        tokenHash: expect.any(String),
        expiresAt: expect.any(Date),
      }),
      select: { id: true },
    });
    expect(result.user).toEqual({
      id: 'user-1',
      email: 'admin@example.gr',
      fullName: 'Demo Admin',
      role: UserRole.ACCOUNTING_OFFICE_ADMIN,
      accountingOffice: {
        id: 'office-1',
        name: 'Demo Office',
      },
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'admin@example.gr' },
      include: {
        accountingOffice: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(user);

    await expect(service.login('admin@example.gr', 'wrong-password')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        failedLoginAttempts: 1,
        lockedUntil: null,
      },
    });
  });

  it('refreshes tokens with a valid refresh token', async () => {
    const refreshToken = jwtWithExpiry('user-1', 'refresh-jti');
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      email: 'admin@example.gr',
      role: UserRole.ACCOUNTING_OFFICE_ADMIN,
      accountingOfficeId: 'office-1',
      jti: 'refresh-jti',
    });
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'old-refresh-row',
      jwtId: 'refresh-jti',
      tokenHash: sha256(refreshToken),
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
      revokedAt: null,
      user,
    });

    const result = await service.refresh(refreshToken);

    expect(result.accessToken).toBe('access-token:user-1');
    expect(result).not.toHaveProperty('refreshTokenId');
    expect(jwtService.verifyAsync).toHaveBeenCalledWith(refreshToken, {
      secret: 'refresh-secret',
    });
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'old-refresh-row' },
      data: {
        revokedAt: expect.any(Date),
        replacedByTokenId: 'refresh-row-1',
      },
    });
  });

  it('changes a user password after verifying the current password', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue({ ...user, passwordHash: 'new-hash' });

    await expect(service.changePassword('user-1', 'ChangeMe123!', 'ChangeMe456!')).resolves.toEqual(
      { changed: true },
    );

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        passwordHash: expect.any(String),
        passwordChangedAt: expect.any(Date),
        failedLoginAttempts: 0,
        lockedUntil: null,
      }),
    });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
  });

  it('rejects password changes with the wrong current password', async () => {
    prisma.user.findUnique.mockResolvedValue(user);

    await expect(
      service.changePassword('user-1', 'wrong-password', 'ChangeMe456!'),
    ).rejects.toThrow('Current password is incorrect.');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

function jwtWithExpiry(sub: string, jti: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ sub, jti, exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString('base64url');
  return `${header}.${payload}.signature`;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
