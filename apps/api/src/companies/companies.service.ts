import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, ClientCompany, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { VatNumberValidatorService } from './vat-number-validator.service';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly vatNumberValidator: VatNumberValidatorService,
  ) {}

  async findAll(tenant: TenantContext): Promise<ClientCompany[]> {
    return this.prisma.clientCompany.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        deletedAt: null,
      },
      orderBy: [{ legalName: 'asc' }],
    });
  }

  async findOne(tenant: TenantContext, id: string): Promise<ClientCompany> {
    const company = await this.prisma.clientCompany.findFirst({
      where: {
        id,
        accountingOfficeId: tenant.accountingOfficeId,
        deletedAt: null,
      },
    });

    if (!company) {
      throw new NotFoundException('Client company was not found.');
    }

    return company;
  }

  async create(tenant: TenantContext, dto: CreateCompanyDto): Promise<ClientCompany> {
    this.ensureValidGreekVatNumber(dto.vatNumber);

    const company = await this.prisma.clientCompany.create({
      data: {
        legalName: dto.legalName,
        tradeName: dto.tradeName,
        entityType: dto.entityType,
        professionLabel: dto.professionLabel,
        vatNumber: dto.vatNumber,
        taxOffice: dto.taxOffice,
        activityCodes: dto.activityCodes ?? undefined,
        address: dto.address,
        email: dto.email,
        phone: dto.phone,
        vatRegime: dto.vatRegime,
        accountingCategory: dto.accountingCategory,
        myDataMode: dto.myDataMode,
        myDataAuthorized: dto.myDataAuthorized,
        myDataCredentialRef: dto.myDataCredentialRef,
        fiscalYearStart: dto.fiscalYearStart,
        fiscalYearEnd: dto.fiscalYearEnd,
        accountingOfficeId: tenant.accountingOfficeId,
      },
    });

    await this.auditService.record({
      tenant,
      action: AuditAction.CREATE,
      entityType: 'ClientCompany',
      entityId: company.id,
      newValue: this.toAuditJson(company),
    });

    return company;
  }

  async update(tenant: TenantContext, id: string, dto: UpdateCompanyDto): Promise<ClientCompany> {
    const existing = await this.findOne(tenant, id);

    if (dto.vatNumber) {
      this.ensureValidGreekVatNumber(dto.vatNumber);
    }

    const company = await this.prisma.clientCompany.update({
      where: { id: existing.id },
      data: this.toCompanyData(dto),
    });

    await this.auditService.record({
      tenant,
      action: AuditAction.UPDATE,
      entityType: 'ClientCompany',
      entityId: company.id,
      oldValue: this.toAuditJson(existing),
      newValue: this.toAuditJson(company),
    });

    return company;
  }

  async softDelete(tenant: TenantContext, id: string): Promise<void> {
    const existing = await this.findOne(tenant, id);
    const company = await this.prisma.clientCompany.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.record({
      tenant,
      action: AuditAction.DELETE,
      entityType: 'ClientCompany',
      entityId: company.id,
      oldValue: this.toAuditJson(existing),
      newValue: this.toAuditJson(company),
    });
  }

  private ensureValidGreekVatNumber(vatNumber: string): void {
    if (!this.vatNumberValidator.isValidGreekVatNumber(vatNumber)) {
      throw new BadRequestException('Greek VAT number / ΑΦΜ must contain exactly 9 digits.');
    }
  }

  private toCompanyData(dto: UpdateCompanyDto): Prisma.ClientCompanyUncheckedUpdateInput {
    return {
      legalName: dto.legalName,
      tradeName: dto.tradeName,
      entityType: dto.entityType,
      professionLabel: dto.professionLabel,
      vatNumber: dto.vatNumber,
      taxOffice: dto.taxOffice,
      activityCodes: dto.activityCodes ?? undefined,
      address: dto.address,
      email: dto.email,
      phone: dto.phone,
      vatRegime: dto.vatRegime,
      accountingCategory: dto.accountingCategory,
      myDataMode: dto.myDataMode,
      myDataAuthorized: dto.myDataAuthorized,
      myDataCredentialRef: dto.myDataCredentialRef,
      fiscalYearStart: dto.fiscalYearStart,
      fiscalYearEnd: dto.fiscalYearEnd,
    };
  }

  private toAuditJson(company: ClientCompany): Prisma.InputJsonValue {
    return {
      id: company.id,
      accountingOfficeId: company.accountingOfficeId,
      legalName: company.legalName,
      tradeName: company.tradeName,
      entityType: company.entityType,
      professionLabel: company.professionLabel,
      vatNumber: company.vatNumber,
      taxOffice: company.taxOffice,
      activityCodes: company.activityCodes as Prisma.InputJsonValue,
      address: company.address,
      email: company.email,
      phone: company.phone,
      vatRegime: company.vatRegime,
      accountingCategory: company.accountingCategory,
      myDataMode: company.myDataMode,
      myDataAuthorized: company.myDataAuthorized,
      myDataCredentialRef: company.myDataCredentialRef,
      fiscalYearStart: company.fiscalYearStart,
      fiscalYearEnd: company.fiscalYearEnd,
      deletedAt: company.deletedAt?.toISOString() ?? null,
    };
  }
}
