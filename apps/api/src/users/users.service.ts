import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenant: TenantContext) {
    return this.prisma.user.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
      },
      select: userSelect,
      orderBy: [{ fullName: 'asc' }, { email: 'asc' }],
    });
  }

  async create(tenant: TenantContext, dto: CreateUserDto) {
    if (dto.role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException('SUPER_ADMIN users cannot be created from office settings.');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException('A user with this email already exists.');
    }

    return this.prisma.user.create({
      data: {
        accountingOfficeId: tenant.accountingOfficeId,
        email: dto.email.toLowerCase(),
        fullName: dto.fullName,
        role: dto.role,
        passwordHash: await bcrypt.hash(dto.password, 12),
      },
      select: userSelect,
    });
  }

  async update(tenant: TenantContext, id: string, dto: UpdateUserDto) {
    const existing = await this.prisma.user.findFirst({
      where: {
        id,
        accountingOfficeId: tenant.accountingOfficeId,
      },
    });

    if (!existing) {
      throw new NotFoundException('User was not found.');
    }

    if (dto.role === UserRole.SUPER_ADMIN && existing.role !== UserRole.SUPER_ADMIN) {
      throw new BadRequestException('SUPER_ADMIN role cannot be assigned from office settings.');
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        fullName: dto.fullName,
        role: dto.role,
      },
      select: userSelect,
    });
  }

  async disable(tenant: TenantContext, id: string) {
    const existing = await this.getTenantUser(tenant, id);

    if (existing.id === tenant.userId) {
      throw new BadRequestException('You cannot disable your own user account.');
    }

    const disabled = await this.prisma.user.update({
      where: { id },
      data: {
        disabledAt: existing.disabledAt ?? new Date(),
      },
      select: userSelect,
    });
    await this.prisma.refreshToken.updateMany({
      where: {
        userId: id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return disabled;
  }

  async enable(tenant: TenantContext, id: string) {
    await this.getTenantUser(tenant, id);

    return this.prisma.user.update({
      where: { id },
      data: {
        disabledAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      select: userSelect,
    });
  }

  private async getTenantUser(tenant: TenantContext, id: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        accountingOfficeId: tenant.accountingOfficeId,
      },
    });

    if (!user) {
      throw new NotFoundException('User was not found.');
    }

    return user;
  }
}

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  disabledAt: true,
  lockedUntil: true,
  failedLoginAttempts: true,
  createdAt: true,
  updatedAt: true,
};
