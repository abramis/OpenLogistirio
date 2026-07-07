import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { JwtUserPayload } from './jwt-payload';

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const PASSWORD_RESET_MINUTES = 30;

type AuthUser = User & { accountingOffice: { id: string; name: string } };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        accountingOffice: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    this.ensureUserCanAuthenticate(user);

    if (!(await bcrypt.compare(password, user.passwordHash))) {
      await this.recordFailedLogin(user);
      throw new UnauthorizedException('Invalid email or password.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    return withoutInternalTokenId(await this.issueTokens(user));
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<JwtUserPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      if (!payload.jti) {
        throw new UnauthorizedException('Refresh token id is missing.');
      }

      const storedRefreshToken = await this.prisma.refreshToken.findUnique({
        where: { jwtId: payload.jti },
        include: {
          user: {
            include: {
              accountingOffice: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (
        !storedRefreshToken ||
        storedRefreshToken.revokedAt ||
        storedRefreshToken.expiresAt <= new Date() ||
        storedRefreshToken.tokenHash !== tokenHash(refreshToken)
      ) {
        throw new UnauthorizedException('Refresh token was revoked or expired.');
      }

      this.ensureUserCanAuthenticate(storedRefreshToken.user);
      const session = await this.issueTokens(storedRefreshToken.user);
      await this.prisma.refreshToken.update({
        where: { id: storedRefreshToken.id },
        data: {
          revokedAt: new Date(),
          replacedByTokenId: session.refreshTokenId,
        },
      });

      return withoutInternalTokenId(session);
    } catch {
      throw new UnauthorizedException('Invalid refresh token.');
    }
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash: tokenHash(refreshToken),
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return { loggedOut: true };
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user || user.disabledAt) {
      return { accepted: true };
    }

    const resetToken = randomBytes(32).toString('base64url');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: tokenHash(resetToken),
        expiresAt: minutesFromNow(PASSWORD_RESET_MINUTES),
      },
    });

    if (this.configService.get<string>('NODE_ENV') === 'production') {
      return { accepted: true };
    }

    return { accepted: true, resetToken };
  }

  async confirmPasswordReset(token: string, newPassword: string) {
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: tokenHash(token) },
      include: { user: true },
    });

    if (
      !resetToken ||
      resetToken.usedAt ||
      resetToken.expiresAt <= new Date() ||
      resetToken.user.disabledAt
    ) {
      throw new BadRequestException('Password reset token is invalid or expired.');
    }

    if (await bcrypt.compare(newPassword, resetToken.user.passwordHash)) {
      throw new BadRequestException('New password must be different from the current password.');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash: await bcrypt.hash(newPassword, 12),
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: {
          userId: resetToken.userId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { reset: true };
  }

  async validateJwtUser(payload: JwtUserPayload): Promise<JwtUserPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        accountingOfficeId: true,
        disabledAt: true,
      },
    });

    if (!user || user.disabledAt) {
      throw new UnauthorizedException('Authenticated user is not active.');
    }

    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      accountingOfficeId: user.accountingOfficeId,
      jti: payload.jti,
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Authenticated user was not found.');
    }

    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new BadRequestException('Current password is incorrect.');
    }

    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      throw new BadRequestException('New password must be different from the current password.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(newPassword, 12),
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    await this.revokeUserRefreshTokens(user.id);

    return { changed: true };
  }

  private async issueTokens(user: AuthUser) {
    const refreshJwtId = randomUUID();
    const payload: JwtUserPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      accountingOfficeId: user.accountingOfficeId,
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.getOrThrow<string>(
          'JWT_ACCESS_EXPIRES_IN',
        ) as JwtSignOptions['expiresIn'],
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.getOrThrow<string>(
          'JWT_REFRESH_EXPIRES_IN',
        ) as JwtSignOptions['expiresIn'],
        jwtid: refreshJwtId,
      }),
    ]);
    const storedRefreshToken = await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        jwtId: refreshJwtId,
        tokenHash: tokenHash(refreshToken),
        expiresAt: jwtExpiry(refreshToken),
      },
      select: { id: true },
    });

    return {
      accessToken,
      refreshToken,
      refreshTokenId: storedRefreshToken.id,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        accountingOffice: user.accountingOffice,
      },
    };
  }

  private ensureUserCanAuthenticate(user: Pick<User, 'disabledAt' | 'lockedUntil'>): void {
    if (user.disabledAt) {
      throw new UnauthorizedException('User account is disabled.');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('User account is temporarily locked.');
    }
  }

  private async recordFailedLogin(user: User): Promise<void> {
    const failedLoginAttempts = user.failedLoginAttempts + 1;
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts,
        lockedUntil:
          failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS
            ? minutesFromNow(LOCK_MINUTES)
            : user.lockedUntil,
      },
    });
  }

  private async revokeUserRefreshTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
}

function withoutInternalTokenId<T extends { refreshTokenId: string }>(session: T) {
  const publicSession: Omit<T, 'refreshTokenId'> = { ...session };
  delete (publicSession as Partial<T>).refreshTokenId;
  return publicSession;
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000);
}

function jwtExpiry(token: string): Date {
  const [, payload] = token.split('.');
  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: number };
  if (!parsed.exp) {
    throw new Error('JWT does not contain an exp claim.');
  }

  return new Date(parsed.exp * 1000);
}
