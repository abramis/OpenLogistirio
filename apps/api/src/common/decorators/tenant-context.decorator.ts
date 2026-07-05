import { BadRequestException, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { TenantContext } from '../tenant/tenant-context';

export const CurrentTenant = createParamDecorator(
  (_data: unknown, context: ExecutionContext): TenantContext => {
    const request = context.switchToHttp().getRequest<Request>();
    const accountingOfficeId = readHeader(request, 'x-office-id');
    const userId = readHeader(request, 'x-user-id');

    if (!accountingOfficeId) {
      throw new BadRequestException('Missing x-office-id tenant header.');
    }

    return {
      accountingOfficeId,
      userId,
    };
  },
);

function readHeader(request: Request, name: string): string | undefined {
  const value = request.headers[name];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}
