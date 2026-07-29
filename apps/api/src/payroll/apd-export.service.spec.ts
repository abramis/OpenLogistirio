import iconv from 'iconv-lite';
import { ApdExportService } from './apd-export.service';

describe('ApdExportService', () => {
  it('creates official fixed-width records and Windows-1253 output', () => {
    const service = new ApdExportService();
    const buffer = service.build({
      declarationType: 'NORMAL',
      periodYear: 2026,
      periodMonth: 7,
      submittedAt: new Date('2026-08-01T00:00:00.000Z'),
      employer: {
        registryNumber: '1234567890',
        submissionOfficeCode: '123',
        submissionOfficeName: 'ΤΟΠΙΚΗ ΔΙΕΥΘΥΝΣΗ',
        legalName: 'ΔΟΚΙΜΗ ΑΕ',
        vatNumber: '123456789',
        street: 'ΣΤΑΔΙΟΥ',
        streetNumber: '1',
        postalCode: '10562',
        city: 'ΑΘΗΝΑ',
      },
      entries: [
        {
          employee: {
            insuranceRegistryNumber: '123456789',
            amka: '01019012345',
            lastName: 'ΠΑΠΑΔΟΠΟΥΛΟΣ',
            firstName: 'ΙΩΑΝΝΗΣ',
            fatherName: 'ΝΙΚΟΛΑΟΣ',
            motherName: 'ΜΑΡΙΑ',
            birthDate: new Date('1990-01-01T00:00:00.000Z'),
            afm: '123456789',
          },
          contract: {
            branchNumber: 0,
            kad: '1234',
            fullTime: true,
            weeklySystem: 'FIVE_DAY',
            specialtyCode: '419000',
            specialInsuranceCase: '00',
            coveragePackageCode: '101',
            externalSupplementaryFund: '00',
            externalHealthFund: '00',
            compensationType: 'MONTHLY',
          },
          employmentFrom: new Date('2026-07-01T00:00:00.000Z'),
          employmentTo: new Date('2026-07-31T00:00:00.000Z'),
          earningsType: '001',
          insuranceDays: 25,
          dailyWage: 40,
          grossEarnings: 1000,
          employeeContributions: 133.7,
          employerContributions: 217.9,
        },
      ],
    });

    const lines = iconv.decode(buffer, 'windows-1253').split('\r\n');
    expect(lines.map((line) => line.length)).toEqual([363, 178, 162, 3]);
    expect(lines[0].slice(0, 3)).toBe('101');
    expect(lines[3]).toBe('EOF');
  });

  it('writes one employee record followed by multiple earnings records', () => {
    const service = new ApdExportService();
    const employee = {
      insuranceRegistryNumber: '123456789',
      amka: '01019012345',
      lastName: 'ΠΑΠΑΔΟΠΟΥΛΟΣ',
      firstName: 'ΙΩΑΝΝΗΣ',
      fatherName: 'ΝΙΚΟΛΑΟΣ',
      motherName: 'ΜΑΡΙΑ',
      birthDate: new Date('1990-01-01T00:00:00.000Z'),
      afm: '123456789',
    };
    const contract = {
      branchNumber: 0,
      kad: '1234',
      fullTime: true,
      weeklySystem: 'FIVE_DAY' as const,
      specialtyCode: '419000',
      specialInsuranceCase: '00',
      coveragePackageCode: '101',
      externalSupplementaryFund: '00',
      externalHealthFund: '00',
      compensationType: 'MONTHLY' as const,
    };
    const buffer = service.build({
      declarationType: 'NORMAL',
      periodYear: 2026,
      periodMonth: 12,
      submittedAt: new Date('2027-01-01T00:00:00.000Z'),
      employer: {
        registryNumber: '1234567890',
        submissionOfficeCode: '123',
        submissionOfficeName: 'ΤΟΠΙΚΗ ΔΙΕΥΘΥΝΣΗ',
        legalName: 'ΔΟΚΙΜΗ ΑΕ',
        vatNumber: '123456789',
        street: 'ΣΤΑΔΙΟΥ',
        streetNumber: '1',
        postalCode: '10562',
        city: 'ΑΘΗΝΑ',
      },
      entries: [
        {
          employee,
          contract,
          employmentFrom: new Date('2026-12-01T00:00:00.000Z'),
          employmentTo: new Date('2026-12-31T00:00:00.000Z'),
          earningsType: '001',
          insuranceDays: 25,
          dailyWage: 40,
          grossEarnings: 1000,
          employeeContributions: 133.7,
          employerContributions: 217.9,
        },
        {
          employee,
          contract,
          employmentFrom: new Date('2026-05-01T00:00:00.000Z'),
          employmentTo: new Date('2026-12-31T00:00:00.000Z'),
          earningsType: '003',
          insuranceDays: 0,
          dailyWage: 40,
          grossEarnings: 1041.67,
          employeeContributions: 139.28,
          employerContributions: 226.99,
        },
      ],
    });
    const lines = iconv.decode(buffer, 'windows-1253').split('\r\n');
    expect(lines.map((line) => line.length)).toEqual([363, 178, 162, 162, 3]);
    expect(lines.filter((line) => line.startsWith('2'))).toHaveLength(1);
  });
});
