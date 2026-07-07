import { UserRole } from '@prisma/client';

export interface JwtUserPayload {
  sub: string;
  email: string;
  role: UserRole;
  accountingOfficeId: string;
  jti?: string;
}
