import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { JwtUserPayload } from './jwt-payload';

const payload: JwtUserPayload = {
  sub: 'user-1',
  email: 'admin@example.gr',
  role: UserRole.ACCOUNTANT,
  accountingOfficeId: 'office-1',
};

describe('AuthGuard', () => {
  let jwtService: jest.Mocked<Pick<JwtService, 'verifyAsync'>>;
  let configService: jest.Mocked<Pick<ConfigService, 'get' | 'getOrThrow'>>;
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;
  let authService: jest.Mocked<Pick<AuthService, 'validateJwtUser'>>;
  let guard: AuthGuard;

  beforeEach(() => {
    jwtService = {
      verifyAsync: jest.fn().mockResolvedValue(payload),
    };
    configService = {
      get: jest.fn().mockReturnValue('test'),
      getOrThrow: jest.fn().mockReturnValue('access-secret'),
    };
    reflector = {
      getAllAndOverride: jest.fn(),
    };
    authService = {
      validateJwtUser: jest.fn().mockResolvedValue(payload),
    };
    guard = new AuthGuard(
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
      reflector as unknown as Reflector,
      authService as unknown as AuthService,
    );
  });

  it('allows routes marked as public', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce(true);

    await expect(guard.canActivate(httpContext({ headers: {} }))).resolves.toBe(true);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects requests without bearer tokens', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce(false);

    await expect(guard.canActivate(httpContext({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('verifies bearer tokens and attaches the jwt payload to the request', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce(false).mockReturnValueOnce(undefined);
    const request = {
      headers: {
        authorization: 'Bearer access-token',
      },
    };

    await expect(guard.canActivate(httpContext(request))).resolves.toBe(true);

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('access-token', {
      secret: 'access-secret',
    });
    expect(authService.validateJwtUser).toHaveBeenCalledWith(payload);
    expect(request).toHaveProperty('user', payload);
  });

  it('rejects authenticated users without the required role', async () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(false)
      .mockReturnValueOnce([UserRole.SUPER_ADMIN]);

    await expect(
      guard.canActivate(
        httpContext({
          headers: {
            authorization: 'Bearer access-token',
          },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('keeps the development tenant header fallback outside production', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce(false);
    const request = {
      headers: {
        'x-office-id': 'office-dev',
        'x-user-id': 'user-dev',
      },
    };

    await expect(guard.canActivate(httpContext(request))).resolves.toBe(true);

    expect(request).toHaveProperty('user', {
      sub: 'user-dev',
      email: 'development-header-user@example.invalid',
      role: UserRole.ACCOUNTING_OFFICE_ADMIN,
      accountingOfficeId: 'office-dev',
    });
  });
});

function httpContext(request: { headers: Record<string, string>; user?: JwtUserPayload }) {
  return {
    getClass: jest.fn(),
    getHandler: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}
