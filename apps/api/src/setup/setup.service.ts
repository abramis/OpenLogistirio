import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { timingSafeEqual } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { InitialSetupDto } from './dto/initial-setup.dto';

const INITIAL_OFFICE_ID = 'open-logistirio-initial-office';

@Injectable()
export class SetupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async status() {
    const required = (await this.prisma.user.count()) === 0;
    return {
      required,
      available: !required || Boolean(this.configService.get<string>('INITIAL_SETUP_TOKEN')),
    };
  }

  async initialize(dto: InitialSetupDto) {
    this.verifySetupToken(dto.setupToken);
    validateInitialPassword(dto.adminPassword);

    if ((await this.prisma.user.count()) > 0) {
      throw new ConflictException('Η αρχική ρύθμιση έχει ήδη ολοκληρωθεί.');
    }

    const passwordHash = await bcrypt.hash(dto.adminPassword, 12);

    try {
      return await this.prisma.$transaction(async (tx) => {
        if ((await tx.user.count()) > 0) {
          throw new ConflictException('Η αρχική ρύθμιση έχει ήδη ολοκληρωθεί.');
        }

        const office = await tx.accountingOffice.create({
          data: {
            id: INITIAL_OFFICE_ID,
            name: dto.officeName.trim(),
            vatNumber: optionalValue(dto.officeVatNumber),
            email: optionalValue(dto.officeEmail)?.toLowerCase(),
            phone: optionalValue(dto.officePhone),
            address: optionalValue(dto.officeAddress),
          },
        });
        const user = await tx.user.create({
          data: {
            accountingOfficeId: office.id,
            email: dto.adminEmail.trim().toLowerCase(),
            fullName: dto.adminFullName.trim(),
            passwordHash,
            role: UserRole.ACCOUNTING_OFFICE_ADMIN,
          },
          select: { id: true, email: true, role: true },
        });

        return {
          office: { id: office.id, name: office.name },
          user,
        };
      });
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Η αρχική ρύθμιση έχει ήδη ολοκληρωθεί.');
      }
      throw error;
    }
  }

  private verifySetupToken(actualToken: string): void {
    const expectedToken = this.configService.get<string>('INITIAL_SETUP_TOKEN');
    if (!expectedToken) {
      throw new ServiceUnavailableException(
        'Η αρχική ρύθμιση δεν είναι διαθέσιμη. Εκτελέστε ξανά την εγκατάσταση.',
      );
    }

    const expected = Buffer.from(expectedToken);
    const actual = Buffer.from(actualToken);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new ForbiddenException('Ο σύνδεσμος αρχικής ρύθμισης δεν είναι έγκυρος.');
    }
  }
}

export function validateInitialPassword(password: string): void {
  if (
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    throw new BadRequestException(
      'Ο κωδικός πρέπει να περιέχει πεζό, κεφαλαίο, αριθμό και σύμβολο.',
    );
  }
  if (/changeme|password|openlogistirio|admin123/i.test(password)) {
    throw new BadRequestException('Ο κωδικός περιέχει μη ασφαλές, προεπιλεγμένο μοτίβο.');
  }
}

function optionalValue(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}
