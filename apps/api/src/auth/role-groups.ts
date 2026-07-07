import { UserRole } from '@prisma/client';

export const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ACCOUNTING_OFFICE_ADMIN];

export const OFFICE_WRITE_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ACCOUNTING_OFFICE_ADMIN,
  UserRole.ACCOUNTANT,
  UserRole.ASSISTANT,
];

export const ACCOUNTING_CONTROL_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ACCOUNTING_OFFICE_ADMIN,
  UserRole.ACCOUNTANT,
];
