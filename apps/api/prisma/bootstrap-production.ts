import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export interface ProductionBootstrapConfig {
  officeName: string;
  officeVatNumber?: string;
  adminEmail: string;
  adminFullName: string;
  adminPassword: string;
}

export function parseProductionBootstrapConfig(env: NodeJS.ProcessEnv): ProductionBootstrapConfig {
  const officeName = required(env, 'BOOTSTRAP_OFFICE_NAME');
  const adminEmail = required(env, 'BOOTSTRAP_ADMIN_EMAIL').toLowerCase();
  const adminFullName = required(env, 'BOOTSTRAP_ADMIN_FULL_NAME');
  const adminPassword = required(env, 'BOOTSTRAP_ADMIN_PASSWORD');
  const officeVatNumber = env.BOOTSTRAP_OFFICE_VAT?.trim() || undefined;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL must be a valid email address.');
  }
  if (officeName.length < 2 || adminFullName.length < 2) {
    throw new Error('Office name and administrator full name must have at least 2 characters.');
  }
  if (officeVatNumber && !/^\d{9}$/.test(officeVatNumber)) {
    throw new Error('BOOTSTRAP_OFFICE_VAT must contain exactly 9 digits.');
  }
  if (
    adminPassword.length < 14 ||
    !/[a-z]/.test(adminPassword) ||
    !/[A-Z]/.test(adminPassword) ||
    !/\d/.test(adminPassword) ||
    !/[^A-Za-z0-9]/.test(adminPassword)
  ) {
    throw new Error(
      'BOOTSTRAP_ADMIN_PASSWORD must have at least 14 characters with upper, lower, number and symbol.',
    );
  }
  if (/changeme|password|openlogistirio|admin123/i.test(adminPassword)) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD contains a forbidden default-password pattern.');
  }

  return { officeName, officeVatNumber, adminEmail, adminFullName, adminPassword };
}

export async function bootstrapProduction(client: PrismaClient, config: ProductionBootstrapConfig) {
  const existingUsers = await client.user.count();
  if (existingUsers > 0) {
    const existingAdmin = await client.user.findUnique({
      where: { email: config.adminEmail },
      select: { id: true, role: true, disabledAt: true },
    });
    if (existingAdmin?.role === UserRole.ACCOUNTING_OFFICE_ADMIN && !existingAdmin.disabledAt) {
      return { created: false, reason: 'already-initialized' as const };
    }
    throw new Error(
      'Production bootstrap refused: the database already contains users. Use the administrator UI.',
    );
  }

  const passwordHash = await bcrypt.hash(config.adminPassword, 12);
  const result = await client.$transaction(async (tx) => {
    const office = await tx.accountingOffice.create({
      data: {
        name: config.officeName,
        vatNumber: config.officeVatNumber,
      },
    });
    const user = await tx.user.create({
      data: {
        accountingOfficeId: office.id,
        email: config.adminEmail,
        fullName: config.adminFullName,
        passwordHash,
        role: UserRole.ACCOUNTING_OFFICE_ADMIN,
      },
      select: { id: true, email: true, role: true },
    });
    return { office: { id: office.id, name: office.name }, user };
  });

  return { created: true, ...result };
}

async function main() {
  if (process.env.NODE_ENV !== 'production') {
    throw new Error('Production bootstrap requires NODE_ENV=production.');
  }
  const config = parseProductionBootstrapConfig(process.env);
  const result = await bootstrapProduction(prisma, config);
  process.stdout.write(
    result.created
      ? 'Production office and administrator created successfully.\n'
      : 'Production database was already initialized for this administrator.\n',
  );
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(name + ' is required.');
  return value;
}

if (require.main === module) {
  main()
    .catch((error) => {
      process.stderr.write(
        (error instanceof Error ? error.message : 'Production bootstrap failed.') + '\n',
      );
      process.exitCode = 1;
    })
    .finally(async () => prisma.$disconnect());
}
