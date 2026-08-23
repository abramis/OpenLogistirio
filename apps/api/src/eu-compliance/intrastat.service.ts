import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  ComplianceSubmissionStatus,
  DocumentType,
  IntrastatFlow,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { buildIntrastatTxt } from './compliance-files';
import {
  GenerateIntrastatReturnDto,
  SubmitComplianceReturnDto,
  UpsertIntrastatLineDto,
} from './dto/eu-compliance.dto';

const include = {
  clientCompany: { select: { id: true, legalName: true, vatNumber: true } },
  lines: { orderBy: { lineNumber: 'asc' as const } },
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
export class IntrastatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async metadata() {
    return {
      flows: Object.values(IntrastatFlow),
      thresholds: await this.prisma.intrastatThreshold.findMany({ orderBy: { year: 'desc' } }),
      officialFileFormat: 'ELSTAT_FIXED_WIDTH_TXT_87',
      officialSource: 'https://eurostat.statistics.gr/',
      acceptedTransactionNatureCodes: [
        '11',
        '12',
        '13',
        '14',
        '19',
        '21',
        '22',
        '23',
        '29',
        '30',
        '41',
        '42',
        '51',
        '52',
        '61',
        '62',
        '63',
        '64',
        '70',
        '80',
        '91',
        '92',
      ],
      acceptedTransportModes: ['1', '2', '3', '4', '5', '7', '8', '9'],
    };
  }

  findAll(tenant: TenantContext, clientCompanyId?: string, periodYear?: number) {
    return this.prisma.intrastatReturn.findMany({
      where: { accountingOfficeId: tenant.accountingOfficeId, clientCompanyId, periodYear },
      include,
      orderBy: [
        { periodYear: 'desc' },
        { periodMonth: 'desc' },
        { flow: 'asc' },
        { revision: 'desc' },
      ],
    });
  }

  async generate(tenant: TenantContext, dto: GenerateIntrastatReturnDto) {
    const company = await this.prisma.clientCompany.findFirst({
      where: {
        id: dto.clientCompanyId,
        accountingOfficeId: tenant.accountingOfficeId,
        deletedAt: null,
      },
    });
    if (!company) throw new NotFoundException('Ο πελάτης δεν βρέθηκε.');
    const enabled =
      dto.flow === IntrastatFlow.ARRIVALS
        ? company.intrastatArrivalsEnabled
        : company.intrastatDispatchesEnabled;
    if (!enabled)
      throw new BadRequestException(
        'Ενεργοποιήστε πρώτα την αντίστοιχη υπαγωγή Intrastat στον πελάτη.',
      );
    const latest = await this.prisma.intrastatReturn.findFirst({
      where: {
        clientCompanyId: dto.clientCompanyId,
        periodYear: dto.periodYear,
        periodMonth: dto.periodMonth,
        flow: dto.flow,
      },
      orderBy: { revision: 'desc' },
    });
    if (latest?.status === ComplianceSubmissionStatus.DRAFT) return this.get(tenant, latest.id);
    if (latest)
      throw new BadRequestException('Υπάρχει ήδη δήλωση Intrastat. Δημιουργήστε τροποποιητική.');
    return this.createFromBooks(tenant, dto, 0);
  }

  async corrective(tenant: TenantContext, id: string) {
    const current = await this.get(tenant, id);
    if (
      current.status !== ComplianceSubmissionStatus.SUBMITTED &&
      current.status !== ComplianceSubmissionStatus.LOCKED
    ) {
      throw new BadRequestException('Τροποποιητική Intrastat δημιουργείται μόνο μετά από υποβολή.');
    }
    if (current.status !== ComplianceSubmissionStatus.LOCKED) {
      await this.prisma.intrastatReturn.update({
        where: { id },
        data: { status: ComplianceSubmissionStatus.LOCKED, lockedAt: new Date() },
      });
    }
    return this.createFromBooks(
      tenant,
      {
        clientCompanyId: current.clientCompanyId,
        periodYear: current.periodYear,
        periodMonth: current.periodMonth,
        flow: current.flow,
      },
      current.revision + 1,
    );
  }

  async upsertLine(
    tenant: TenantContext,
    returnId: string,
    lineId: string | undefined,
    dto: UpsertIntrastatLineDto,
  ) {
    const declaration = await this.get(tenant, returnId);
    this.requireDraft(declaration.status);
    const lineNumber =
      dto.lineNumber ??
      (declaration.lines.length
        ? Math.max(...declaration.lines.map((line) => line.lineNumber)) + 1
        : 1);
    const data = {
      lineNumber,
      countryCode: dto.countryCode.toUpperCase(),
      transactionNature: dto.transactionNature,
      transportMode: dto.transportMode,
      commodityCode: dto.commodityCode,
      netMassKg: dto.netMassKg,
      supplementaryUnits: dto.supplementaryUnits,
      invoicedAmount: dto.invoicedAmount,
      statisticalValue: dto.statisticalValue,
      partnerVatNumber: dto.partnerVatNumber?.trim().toUpperCase() || null,
      countryOfOrigin: dto.countryOfOrigin?.toUpperCase() || null,
      deliveryTerms: dto.deliveryTerms?.toUpperCase() || null,
      sourceDocumentId: dto.sourceDocumentId || null,
    };
    if (!EU_CODES.has(data.countryCode)) throw new BadRequestException('Μη έγκυρη χώρα Intrastat.');
    if (lineId) {
      if (!declaration.lines.some((line) => line.id === lineId))
        throw new NotFoundException('Η γραμμή Intrastat δεν βρέθηκε.');
      await this.prisma.intrastatLine.update({ where: { id: lineId }, data });
    } else {
      await this.prisma.intrastatLine.create({ data: { intrastatReturnId: returnId, ...data } });
    }
    return this.recompute(tenant, returnId);
  }

  async deleteLine(tenant: TenantContext, returnId: string, lineId: string) {
    const declaration = await this.get(tenant, returnId);
    this.requireDraft(declaration.status);
    if (!declaration.lines.some((line) => line.id === lineId))
      throw new NotFoundException('Η γραμμή Intrastat δεν βρέθηκε.');
    await this.prisma.intrastatLine.delete({ where: { id: lineId } });
    return this.recompute(tenant, returnId);
  }

  async ready(tenant: TenantContext, id: string) {
    const current = await this.recompute(tenant, id);
    this.requireDraft(current.status);
    if (current.blockerCount)
      throw new BadRequestException('Η δήλωση Intrastat έχει εκκρεμότητες συμφωνίας.');
    return this.setStatus(tenant, id, ComplianceSubmissionStatus.READY, 'INTRASTAT_READY');
  }

  async file(tenant: TenantContext, id: string) {
    const current = await this.get(tenant, id);
    if (
      current.status !== ComplianceSubmissionStatus.READY &&
      current.status !== ComplianceSubmissionStatus.FILE_GENERATED
    ) {
      throw new BadRequestException('Το αρχείο Intrastat δημιουργείται μόνο από έτοιμη δήλωση.');
    }
    const file = buildIntrastatTxt(current);
    await this.prisma.intrastatReturn.update({
      where: { id },
      data: {
        status: ComplianceSubmissionStatus.FILE_GENERATED,
        fileChecksumSha256: file.checksumSha256,
        fileGeneratedAt: new Date(),
      },
    });
    await this.event(tenant, id, 'INTRASTAT_FILE_GENERATED', {
      checksumSha256: file.checksumSha256,
    });
    return file;
  }

  async submit(tenant: TenantContext, id: string, dto: SubmitComplianceReturnDto) {
    const current = await this.get(tenant, id);
    if (current.status !== ComplianceSubmissionStatus.FILE_GENERATED)
      throw new BadRequestException('Απαιτείται πρώτα παραγωγή αρχείου Intrastat.');
    const result = await this.prisma.intrastatReturn.update({
      where: { id },
      data: {
        status: ComplianceSubmissionStatus.SUBMITTED,
        submittedAt: new Date(dto.submittedAt),
        submissionProtocol: dto.submissionProtocol.trim(),
      },
      include,
    });
    await this.event(tenant, id, 'INTRASTAT_SUBMITTED', { protocol: result.submissionProtocol });
    return result;
  }

  async lock(tenant: TenantContext, id: string) {
    const current = await this.get(tenant, id);
    if (current.status !== ComplianceSubmissionStatus.SUBMITTED)
      throw new BadRequestException('Κλειδώνει μόνο υποβλημένη δήλωση Intrastat.');
    return this.setStatus(tenant, id, ComplianceSubmissionStatus.LOCKED, 'INTRASTAT_LOCKED', {
      lockedAt: new Date(),
    });
  }

  private async createFromBooks(
    tenant: TenantContext,
    dto: GenerateIntrastatReturnDto,
    revision: number,
  ) {
    const threshold = await this.prisma.intrastatThreshold.findUnique({
      where: { year: dto.periodYear },
    });
    if (!threshold) {
      throw new BadRequestException(
        `Δεν υπάρχει επαληθευμένο επίσημο κατώφλι Intrastat για το ${dto.periodYear}.`,
      );
    }
    const types =
      dto.flow === IntrastatFlow.ARRIVALS
        ? [DocumentType.PURCHASE_INVOICE, DocumentType.PURCHASE_CREDIT_NOTE]
        : [DocumentType.SALES_INVOICE, DocumentType.CREDIT_NOTE];
    const [yearDocuments, previousDocuments] = await Promise.all([
      this.prisma.document.findMany({
        where: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId: dto.clientCompanyId,
          deletedAt: null,
          documentType: { in: types },
          issueDate: {
            gte: new Date(Date.UTC(dto.periodYear, 0, 1)),
            lt: new Date(Date.UTC(dto.periodYear, dto.periodMonth, 1)),
          },
        },
        select: {
          id: true,
          issueDate: true,
          counterpartyVatNumber: true,
          netAmount: true,
          documentType: true,
        },
      }),
      this.prisma.document.findMany({
        where: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId: dto.clientCompanyId,
          deletedAt: null,
          documentType: { in: types },
          issueDate: {
            gte: new Date(Date.UTC(dto.periodYear - 1, 0, 1)),
            lt: new Date(Date.UTC(dto.periodYear, 0, 1)),
          },
        },
        select: { counterpartyVatNumber: true, netAmount: true, documentType: true },
      }),
    ]);
    const euYear = yearDocuments.filter((item) => isEuVat(item.counterpartyVatNumber));
    const euPrevious = previousDocuments.filter((item) => isEuVat(item.counterpartyVatNumber));
    const yearToDateAmount = money(euYear.reduce((total, item) => total + signedAmount(item), 0));
    const previousYearAmount = money(
      euPrevious.reduce((total, item) => total + signedAmount(item), 0),
    );
    const thresholdAmount = Number(
      dto.flow === IntrastatFlow.ARRIVALS ? threshold.arrivalsAmount : threshold.dispatchesAmount,
    );
    const thresholdExceeded =
      yearToDateAmount > thresholdAmount || previousYearAmount > thresholdAmount;
    const periodDocumentIds = euYear
      .filter((item) => item.issueDate.getUTCMonth() + 1 === dto.periodMonth)
      .map((item) => item.id);
    const periodBookAmount = money(
      euYear
        .filter((item) => item.issueDate.getUTCMonth() + 1 === dto.periodMonth)
        .reduce((total, item) => total + signedAmount(item), 0),
    );
    const blockers = [
      'Καταχωρίστε τις γραμμές CN8, μάζας, ποσότητας και στατιστικής αξίας από τα παραστατικά του μήνα.',
    ];
    const created = await this.prisma.intrastatReturn.create({
      data: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: dto.clientCompanyId,
        periodYear: dto.periodYear,
        periodMonth: dto.periodMonth,
        flow: dto.flow,
        returnType: revision ? 'AMENDING' : 'INITIAL',
        revision,
        thresholdAmount,
        yearToDateAmount,
        thresholdExceeded,
        reconciliation: {
          matched: false,
          blockers,
          periodBookAmount,
          periodDocumentIds,
          previousYearAmount,
          officialThresholdSource: threshold.officialSource,
        },
        blockerCount: blockers.length,
      },
      include,
    });
    await this.event(tenant, created.id, 'INTRASTAT_GENERATED', {
      revision,
      flow: dto.flow,
      thresholdExceeded,
    });
    return created;
  }

  private async recompute(tenant: TenantContext, id: string) {
    const current = await this.get(tenant, id);
    const previous = readReconciliation(current.reconciliation);
    const declaredAmount = current.lines.reduce((total, line) => total + line.invoicedAmount, 0);
    const statisticalAmount = current.lines.reduce(
      (total, line) => total + line.statisticalValue,
      0,
    );
    const blockers: string[] = [];
    if (!current.lines.length) blockers.push('Η δήλωση Intrastat δεν έχει γραμμές.');
    if (Math.round(previous.periodBookAmount) !== declaredAmount) {
      blockers.push(
        'Το τιμολογούμενο ποσό Intrastat δεν συμφωνεί με τα ενδοενωσιακά παραστατικά του μήνα.',
      );
    }
    const sourceIds = new Set(current.lines.map((line) => line.sourceDocumentId).filter(Boolean));
    const missingDocumentIds = previous.periodDocumentIds.filter(
      (documentId) => !sourceIds.has(documentId),
    );
    if (missingDocumentIds.length)
      blockers.push(
        `Υπάρχουν ${missingDocumentIds.length} παραστατικά χωρίς συσχετισμένη γραμμή Intrastat.`,
      );
    const reconciliation = {
      ...previous,
      matched: blockers.length === 0,
      blockers,
      missingDocumentIds,
      declaredAmount,
      statisticalAmount,
    };
    return this.prisma.intrastatReturn.update({
      where: { id },
      data: {
        declaredAmount,
        statisticalAmount,
        reconciliation: reconciliation as Prisma.InputJsonValue,
        blockerCount: blockers.length,
      },
      include,
    });
  }

  private async get(tenant: TenantContext, id: string) {
    const value = await this.prisma.intrastatReturn.findFirst({
      where: { id, accountingOfficeId: tenant.accountingOfficeId },
      include,
    });
    if (!value) throw new NotFoundException('Η δήλωση Intrastat δεν βρέθηκε.');
    return value;
  }

  private requireDraft(status: ComplianceSubmissionStatus) {
    if (status !== ComplianceSubmissionStatus.DRAFT)
      throw new BadRequestException('Η ενέργεια επιτρέπεται μόνο σε πρόχειρη Intrastat.');
  }

  private async setStatus(
    tenant: TenantContext,
    id: string,
    status: ComplianceSubmissionStatus,
    event: string,
    extra: Prisma.IntrastatReturnUpdateInput = {},
  ) {
    const result = await this.prisma.intrastatReturn.update({
      where: { id },
      data: { status, ...extra },
      include,
    });
    await this.event(tenant, id, event, {});
    return result;
  }

  private event(tenant: TenantContext, entityId: string, event: string, details: object) {
    return this.audit.record({
      tenant,
      action: AuditAction.UPDATE,
      entityType: 'IntrastatReturn',
      entityId,
      newValue: { event, ...details } as Prisma.InputJsonValue,
    });
  }
}

function isEuVat(value: string | null | undefined): boolean {
  return EU_CODES.has(
    value
      ?.replace(/[^A-Z0-9]/gi, '')
      .toUpperCase()
      .slice(0, 2) ?? '',
  );
}

function signedAmount(value: { documentType: DocumentType; netAmount: Prisma.Decimal }): number {
  const credit =
    value.documentType === DocumentType.CREDIT_NOTE ||
    value.documentType === DocumentType.PURCHASE_CREDIT_NOTE;
  return Number(value.netAmount) * (credit ? -1 : 1);
}

function readReconciliation(value: Prisma.JsonValue) {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    periodBookAmount: Number(source['periodBookAmount'] ?? 0),
    periodDocumentIds: Array.isArray(source['periodDocumentIds'])
      ? source['periodDocumentIds'].filter((item): item is string => typeof item === 'string')
      : [],
    previousYearAmount: Number(source['previousYearAmount'] ?? 0),
    officialThresholdSource: String(source['officialThresholdSource'] ?? ''),
  };
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
