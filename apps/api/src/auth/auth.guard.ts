import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import { JwtUserPayload } from './jwt-payload';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: JwtUserPayload }>();
    const token = this.readBearerToken(request);
    if (!token) {
      this.applyDevelopmentTenantFallback(request);
      if (request.user) {
        return true;
      }
      throw new UnauthorizedException('Missing bearer token.');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtUserPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      request.user = await this.authService.validateJwtUser(payload);
    } catch {
      throw new UnauthorizedException('Invalid bearer token.');
    }

    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles?.length && !roles.includes(request.user.role)) {
      throw new ForbiddenException('User role is not allowed for this action.');
    }

    return true;
  }

  private readBearerToken(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    const value = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    if (!value?.startsWith('Bearer ')) {
      return undefined;
    }

    return value.slice('Bearer '.length).trim();
  }

  private applyDevelopmentTenantFallback(request: Request & { user?: JwtUserPayload }): void {
    if (this.configService.get<string>('NODE_ENV') === 'production') {
      return;
    }

    const accountingOfficeId = readHeader(request, 'x-office-id');
    if (!accountingOfficeId) {
      return;
    }

    request.user = {
      sub: readHeader(request, 'x-user-id') ?? 'development-header-user',
      email: 'development-header-user@example.invalid',
      role: UserRole.ACCOUNTING_OFFICE_ADMIN,
      accountingOfficeId,
    };
  }
}

function readHeader(request: Request, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}
