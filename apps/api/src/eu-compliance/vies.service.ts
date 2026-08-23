import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  ComplianceSubmissionStatus,
  DocumentType,
  MyDataSyncSource,
  Prisma,
  ViesReturnKind,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { buildViesXml } from './compliance-files';
import {
  GenerateViesReturnDto,
  SubmitComplianceReturnDto,
  UpsertViesLineDto,
} from './dto/eu-compliance.dto';
import { ViesValidationService } from './vies-validation.service';

const include = {
  clientCompany: { select: { id: true, legalName: true, vatNumber: true, address: true } },
  lines: { orderBy: [{ countryCode: 'asc' as const }, { vatNumber: 'asc' as const }] },
};

const EU_CODES = new Set([
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DE',
  'DK',
  'EE',
  'ES',
  'FI',
  'FR',
  'HU',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SE',
  'SI',
  'SK',
  'XI',
]);

@Injectable()
export class ViesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: ViesValidationService,
    private readonly audit: AuditService,
  ) {}

  metadata() {
    return {
      kinds: Object.values(ViesReturnKind),
      deadlineRule: '26_OF_FOLLOWING_MONTH',
      officialXmlSchema: 'AADE F4_2009 / F5_2009',
      officialSource: 'https://www.aade.gr/diloseis-fpa-vies',
      euCountryCodes: [...EU_CODES],
    };
  }

  findAll(tenant: TenantContext, clientCompanyId?: string, periodYear?: number) {
    return this.prisma.viesReturn.findMany({
      where: { accountingOfficeId: tenant.accountingOfficeId, clientCompanyId, periodYear },
      include,
      orderBy: [
        { periodYear: 'desc' },
        { periodMonth: 'desc' },
        { kind: 'asc' },
        { revision: 'desc' },
      ],
    });
  }

  async generate(tenant: TenantContext, dto: GenerateViesReturnDto) {
    const company = await this.prisma.clientCompany.findFirst({
      where: {
        id: dto.clientCompanyId,
        accountingOfficeId: tenant.accountingOfficeId,
        deletedAt: null,
      },
    });
    if (!company) throw new NotFoundException('Ο πελάτης δεν βρέθηκε.');
    if (!company.viesEnabled) {
      throw new BadRequestException(
        'Ενεργοποιήστε πρώτα την υπαγωγή VIES στις ρυθμίσεις του πελάτη.',
      );
    }
    const latest = await this.prisma.viesReturn.findFirst({
      where: {
        clientCompanyId: company.id,
        periodYear: dto.periodYear,
        periodMonth: dto.periodMonth,
        kind: dto.kind,
      },
      orderBy: { revision: 'desc' },
    });
    if (latest?.status === ComplianceSubmissionStatus.DRAFT) return this.get(tenant, latest.id);
    if (latest) {
      throw new BadRequestException('Υπάρχει ήδη πίνακας VIES. Χρησιμοποιήστε διορθωτική έκδοση.');
    }
    return this.createFromSources(tenant, dto, 0);
  }

  async corrective(tenant: TenantContext, id: string) {
    const current = await this.get(tenant, id);
    if (
      current.status !== ComplianceSubmissionStatus.SUBMITTED &&
      current.status !== ComplianceSubmissionStatus.LOCKED
    ) {
      throw new BadRequestException('Διορθωτικός VIES δημιουργείται μόνο μετά από υποβολή.');
    }
    if (current.status !== ComplianceSubmissionStatus.LOCKED) {
      await this.prisma.viesReturn.update({
        where: { id },
        data: { status: ComplianceSubmissionStatus.LOCKED, lockedAt: new Date() },
      });
    }
    return this.createFromSources(
      tenant,
      {
        clientCompanyId: current.clientCompanyId,
        periodYear: current.periodYear,
        periodMonth: current.periodMonth,
        kind: current.kind,
      },
      current.revision + 1,
    );
  }

  async upsertLine(
    tenant: TenantContext,
    returnId: string,
    lineId: string | undefined,
    dto: UpsertViesLineDto,
  ) {
    const declaration = await this.get(tenant, returnId);
    this.requireDraft(declaration.status);
    const countryCode = dto.countryCode.toUpperCase();
    if (!EU_CODES.has(countryCode))
      throw new BadRequestException('Ο κωδικός χώρας δεν ανήκει στο VIES.');
    const vatNumber = normalizeVat(dto.vatNumber, countryCode);
    if (lineId) {
      const existing = declaration.lines.find((line) => line.id === lineId);
      if (!existing) throw new NotFoundException('Η γραμμή VIES δεν βρέθηκε.');
      await this.prisma.viesReturnLine.update({
        where: { id: lineId },
        data: {
          countryCode,
          vatNumber,
          counterpartyName: dto.counterpartyName?.trim() || null,
          goodsAmount: dto.goodsAmount,
          triangularAmount: dto.triangularAmount,
          servicesAmount: dto.servicesAmount,
          vatValid: null,
          vatCheckedAt: null,
          vatRequestIdentifier: null,
        },
      });
    } else {
      await this.prisma.viesReturnLine.create({
        data: {
          viesReturnId: returnId,
          countryCode,
          vatNumber,
          counterpartyName: dto.counterpartyName?.trim() || null,
          goodsAmount: dto.goodsAmount,
          triangularAmount: dto.triangularAmount,
          servicesAmount: dto.servicesAmount,
          sourceDocumentIds: [],
        },
      });
    }
    return this.recompute(tenant, returnId);
  }

  async deleteLine(tenant: TenantContext, returnId: string, lineId: string) {
    const declaration = await this.get(tenant, returnId);
    this.requireDraft(declaration.status);
    if (!declaration.lines.some((line) => line.id === lineId))
      throw new NotFoundException('Η γραμμή VIES δεν βρέθηκε.');
    await this.prisma.viesReturnLine.delete({ where: { id: lineId } });
    return this.recompute(tenant, returnId);
  }

  async checkVat(tenant: TenantContext, returnId: string, lineId: string) {
    const declaration = await this.get(tenant, returnId);
    this.requireDraft(declaration.status);
    const line = declaration.lines.find((item) => item.id === lineId);
    if (!line) throw new NotFoundException('Η γραμμή VIES δεν βρέθηκε.');
    const result = await this.validator.check(
      line.countryCode,
      line.vatNumber,
      declaration.clientCompany.vatNumber,
    );
    await this.prisma.viesReturnLine.update({
      where: { id: lineId },
      data: {
        vatValid: result.valid,
        vatCheckedAt: new Date(),
        vatRequestIdentifier: result.requestIdentifier,
        counterpartyName:
          result.name && result.name !== '---' ? result.name : line.counterpartyName,
      },
    });
    await this.auditEvent(tenant, returnId, 'VIES_VAT_CHECKED', {
      countryCode: line.countryCode,
      vatNumber: line.vatNumber,
      valid: result.valid,
      requestIdentifier: result.requestIdentifier,
    });
    return this.recompute(tenant, returnId);
  }

  async ready(tenant: TenantContext, id: string) {
    const current = await this.recompute(tenant, id);
    this.requireDraft(current.status);
    if (current.blockerCount)
      throw new BadRequestException('Ο πίνακας VIES έχει εκκρεμότητες συμφωνίας ή ελέγχου VAT.');
    return this.setStatus(tenant, id, ComplianceSubmissionStatus.READY, 'VIES_READY');
  }

  async file(tenant: TenantContext, id: string) {
    const current = await this.get(tenant, id);
    if (
      current.status !== ComplianceSubmissionStatus.READY &&
      current.status !== ComplianceSubmissionStatus.FILE_GENERATED
    ) {
      throw new BadRequestException('Το αρχείο VIES δημιουργείται μόνο από έτοιμο πίνακα.');
    }
    const file = buildViesXml(current);
    await this.prisma.viesReturn.update({
      where: { id },
      data: {
        status: ComplianceSubmissionStatus.FILE_GENERATED,
        fileChecksumSha256: file.checksumSha256,
        fileGeneratedAt: new Date(),
      },
    });
    await this.auditEvent(tenant, id, 'VIES_FILE_GENERATED', {
      checksumSha256: file.checksumSha256,
    });
    return file;
  }

  async submit(tenant: TenantContext, id: string, dto: SubmitComplianceReturnDto) {
    const current = await this.get(tenant, id);
    if (current.status !== ComplianceSubmissionStatus.FILE_GENERATED)
      throw new BadRequestException('Απαιτείται πρώτα παραγωγή αρχείου VIES.');
    const result = await this.prisma.viesReturn.update({
      where: { id },
      data: {
        status: ComplianceSubmissionStatus.SUBMITTED,
        submittedAt: new Date(dto.submittedAt),
        submissionProtocol: dto.submissionProtocol.trim(),
      },
      include,
    });
    await this.auditEvent(tenant, id, 'VIES_SUBMITTED', { protocol: result.submissionProtocol });
    return result;
  }

  async lock(tenant: TenantContext, id: string) {
    const current = await this.get(tenant, id);
    if (current.status !== ComplianceSubmissionStatus.SUBMITTED)
      throw new BadRequestException('Κλειδώνει μόνο υποβλημένος πίνακας VIES.');
    return this.setStatus(tenant, id, ComplianceSubmissionStatus.LOCKED, 'VIES_LOCKED', {
      lockedAt: new Date(),
    });
  }

  private async createFromSources(
    tenant: TenantContext,
    dto: GenerateViesReturnDto,
    revision: number,
  ) {
    const range = monthRange(dto.periodYear, dto.periodMonth);
    const types =
      dto.kind === ViesReturnKind.F4_SUPPLIES
        ? [DocumentType.SALES_INVOICE, DocumentType.CREDIT_NOTE]
        : [DocumentType.PURCHASE_INVOICE, DocumentType.PURCHASE_CREDIT_NOTE];
    const [documents, snapshots] = await Promise.all([
      this.prisma.document.findMany({
        where: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId: dto.clientCompanyId,
          deletedAt: null,
          issueDate: range,
          documentType: { in: types },
        },
        include: { lines: true },
      }),
      this.prisma.myDataSnapshot.findMany({
        where: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId: dto.clientCompanyId,
          issueDate: range,
          source:
            dto.kind === ViesReturnKind.F4_SUPPLIES
              ? MyDataSyncSource.REQUEST_TRANSMITTED_DOCS
              : MyDataSyncSource.REQUEST_DOCS,
        },
      }),
    ]);
    const euDocuments = documents.filter((document) => parseEuVat(document.counterpartyVatNumber));
    const groups = new Map<string, typeof euDocuments>();
    for (const document of euDocuments) {
      const vat = parseEuVat(document.counterpartyVatNumber)!;
      const key = `${vat.countryCode}:${vat.vatNumber}`;
      groups.set(key, [...(groups.get(key) ?? []), document]);
    }
    const lines = [...groups.entries()].map(([key, docs]) => {
      const [countryCode, vatNumber] = key.split(':');
      const servicesAmount = money(
        docs.filter(isServicesDocument).reduce((total, item) => total + signedNet(item), 0),
      );
      const goodsAmount = money(
        docs
          .filter((item) => !isServicesDocument(item))
          .reduce((total, item) => total + signedNet(item), 0),
      );
      return {
        countryCode,
        vatNumber,
        counterpartyName: docs.find((item) => item.counterpartyName)?.counterpartyName,
        goodsAmount,
        servicesAmount,
        triangularAmount: 0,
        sourceDocumentIds: docs.map((item) => item.id),
      };
    });
    const sourceBookAmount = money(euDocuments.reduce((total, item) => total + signedNet(item), 0));
    const sourceMyDataAmount = money(
      snapshots
        .filter((item) =>
          parseEuVat(
            dto.kind === ViesReturnKind.F4_SUPPLIES
              ? item.counterpartyVatNumber
              : item.issuerVatNumber,
          ),
        )
        .reduce(
          (total, item) =>
            total + Number(item.netAmount ?? 0) * (item.invoiceType?.startsWith('5.') ? -1 : 1),
          0,
        ),
    );
    const declaredAmount = money(
      lines.reduce(
        (total, line) => total + line.goodsAmount + line.servicesAmount + line.triangularAmount,
        0,
      ),
    );
    const reconciliation = reconcileVies(
      sourceBookAmount,
      sourceMyDataAmount,
      declaredAmount,
      lines,
    );
    const created = await this.prisma.viesReturn.create({
      data: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: dto.clientCompanyId,
        periodYear: dto.periodYear,
        periodMonth: dto.periodMonth,
        kind: dto.kind,
        returnType: revision ? 'AMENDING' : 'INITIAL',
        revision,
        sourceBookAmount,
        sourceMyDataAmount,
        declaredAmount,
        reconciliation: reconciliation as Prisma.InputJsonValue,
        blockerCount: reconciliation.blockers.length,
        lines: { create: lines },
      },
      include,
    });
    await this.auditEvent(tenant, created.id, 'VIES_GENERATED', { revision, kind: dto.kind });
    return created;
  }

  private async recompute(tenant: TenantContext, id: string) {
    const current = await this.get(tenant, id);
    const declaredAmount = money(
      current.lines.reduce(
        (total, line) =>
          total +
          Number(line.goodsAmount) +
          Number(line.triangularAmount) +
          Number(line.servicesAmount),
        0,
      ),
    );
    const reconciliation = reconcileVies(
      Number(current.sourceBookAmount),
      Number(current.sourceMyDataAmount),
      declaredAmount,
      current.lines,
    );
    return this.prisma.viesReturn.update({
      where: { id },
      data: {
        declaredAmount,
        reconciliation: reconciliation as Prisma.InputJsonValue,
        blockerCount: reconciliation.blockers.length,
      },
      include,
    });
  }

  private async get(tenant: TenantContext, id: string) {
    const value = await this.prisma.viesReturn.findFirst({
      where: { id, accountingOfficeId: tenant.accountingOfficeId },
      include,
    });
    if (!value) throw new NotFoundException('Ο πίνακας VIES δεν βρέθηκε.');
    return value;
  }

  private requireDraft(status: ComplianceSubmissionStatus) {
    if (status !== ComplianceSubmissionStatus.DRAFT)
      throw new BadRequestException('Η ενέργεια επιτρέπεται μόνο σε πρόχειρο πίνακα VIES.');
  }

  private async setStatus(
    tenant: TenantContext,
    id: string,
    status: ComplianceSubmissionStatus,
    event: string,
    extra: Prisma.ViesReturnUpdateInput = {},
  ) {
    const result = await this.prisma.viesReturn.update({
      where: { id },
      data: { status, ...extra },
      include,
    });
    await this.auditEvent(tenant, id, event, {});
    return result;
  }

  private auditEvent(tenant: TenantContext, entityId: string, event: string, details: object) {
    return this.audit.record({
      tenant,
      action: AuditAction.UPDATE,
      entityType: 'ViesReturn',
      entityId,
      newValue: { event, ...details } as Prisma.InputJsonValue,
    });
  }
}

function reconcileVies(
  bookAmount: number,
  myDataAmount: number,
  declaredAmount: number,
  lines: Array<{
    vatValid?: boolean | null;
    goodsAmount: unknown;
    triangularAmount: unknown;
    servicesAmount: unknown;
  }>,
) {
  const blockers: string[] = [];
  if (!lines.length) blockers.push('Δεν υπάρχουν ενδοκοινοτικές γραμμές.');
  if (money(bookAmount) !== money(declaredAmount))
    blockers.push('Το δηλωμένο ποσό δεν συμφωνεί με τα βιβλία.');
  if (bookAmount !== 0 && money(bookAmount) !== money(myDataAmount))
    blockers.push('Τα βιβλία δεν συμφωνούν με τα διαθέσιμα δεδομένα myDATA.');
  if (lines.some((line) => line.vatValid === null))
    blockers.push('Υπάρχουν VAT numbers χωρίς τρέχοντα έλεγχο VIES.');
  if (lines.some((line) => line.vatValid === false))
    blockers.push('Υπάρχουν μη έγκυρα VAT numbers στο VIES.');
  if (
    lines.some(
      (line) =>
        Number(line.goodsAmount) + Number(line.triangularAmount) + Number(line.servicesAmount) < 0,
    )
  ) {
    blockers.push(
      'Υπάρχει αρνητικό καθαρό ποσό αντισυμβαλλόμενου που χρειάζεται λογιστικό έλεγχο.',
    );
  }
  return { matched: blockers.length === 0, blockers, bookAmount, myDataAmount, declaredAmount };
}

function monthRange(year: number, month: number) {
  return { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) };
}

function parseEuVat(value: string | null | undefined) {
  const normalized = value?.replace(/[^A-Z0-9]/gi, '').toUpperCase() ?? '';
  const countryCode = normalized.slice(0, 2);
  if (!EU_CODES.has(countryCode) || normalized.length < 4) return null;
  return { countryCode, vatNumber: normalized.slice(2) };
}

function normalizeVat(value: string, countryCode: string): string {
  const normalized = value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const result = normalized.startsWith(countryCode) ? normalized.slice(2) : normalized;
  if (!result) throw new BadRequestException('Λείπει ο αριθμός ΦΠΑ.');
  return result;
}

function isServicesDocument(document: {
  lines: Array<{
    incomeClassificationCategory: string | null;
    expenseClassificationCategory: string | null;
  }>;
}) {
  return document.lines.some((line) =>
    [line.incomeClassificationCategory, line.expenseClassificationCategory].some((value) =>
      value?.toLowerCase().includes('category1_3'),
    ),
  );
}

function signedNet(document: { documentType: DocumentType; netAmount: Prisma.Decimal }) {
  return (
    Number(document.netAmount) *
    (document.documentType === DocumentType.CREDIT_NOTE ||
    document.documentType === DocumentType.PURCHASE_CREDIT_NOTE
      ? -1
      : 1)
  );
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
