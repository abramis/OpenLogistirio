import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CompaniesController } from '../../src/companies/companies.controller';
import { CompaniesService } from '../../src/companies/companies.service';

describe('CompaniesController (e2e)', () => {
  let app: INestApplication;
  const companiesService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };

  const company = {
    id: 'company-1',
    legalName: 'Demo Company',
    vatNumber: '123456789',
    fiscalYearStart: 1,
    fiscalYearEnd: 12,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [CompaniesController],
      providers: [{ provide: CompaniesService, useValue: companiesService }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('performs the CRUD endpoints with tenant headers', async () => {
    companiesService.findAll.mockResolvedValue([company]);
    companiesService.findOne.mockResolvedValue(company);
    companiesService.create.mockResolvedValue(company);
    companiesService.update.mockResolvedValue({ ...company, legalName: 'Updated Company' });
    companiesService.softDelete.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .get('/companies')
      .set('x-office-id', 'office-1')
      .expect(200)
      .expect([company]);

    await request(app.getHttpServer())
      .get('/companies/company-1')
      .set('x-office-id', 'office-1')
      .expect(200)
      .expect(company);

    await request(app.getHttpServer())
      .post('/companies')
      .set('x-office-id', 'office-1')
      .set('x-user-id', 'user-1')
      .send({ legalName: 'Demo Company', vatNumber: '123456789' })
      .expect(201)
      .expect(company);

    await request(app.getHttpServer())
      .patch('/companies/company-1')
      .set('x-office-id', 'office-1')
      .set('x-user-id', 'user-1')
      .send({ legalName: 'Updated Company' })
      .expect(200)
      .expect({ ...company, legalName: 'Updated Company' });

    await request(app.getHttpServer())
      .delete('/companies/company-1')
      .set('x-office-id', 'office-1')
      .set('x-user-id', 'user-1')
      .expect(204);

    expect(companiesService.findAll).toHaveBeenCalledWith({ accountingOfficeId: 'office-1' });
    expect(companiesService.create).toHaveBeenCalledWith(
      { accountingOfficeId: 'office-1', userId: 'user-1' },
      { legalName: 'Demo Company', vatNumber: '123456789' },
    );
    expect(companiesService.softDelete).toHaveBeenCalledWith(
      { accountingOfficeId: 'office-1', userId: 'user-1' },
      'company-1',
    );
  });

  it('rejects requests without tenant headers', async () => {
    await request(app.getHttpServer()).get('/companies').expect(400);
  });

  it('validates create payloads', async () => {
    await request(app.getHttpServer())
      .post('/companies')
      .set('x-office-id', 'office-1')
      .send({ legalName: 'D', vatNumber: '123' })
      .expect(400);
  });
});
