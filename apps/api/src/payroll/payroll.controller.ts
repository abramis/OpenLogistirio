import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ACCOUNTING_CONTROL_ROLES, OFFICE_WRITE_ROLES } from '../auth/role-groups';
import { Roles } from '../auth/roles.decorator';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { TenantContext } from '../common/tenant/tenant-context';
import {
  CalculatePayrollPeriodDto,
  CompleteApdSubmissionDto,
  CompleteFmySubmissionDto,
  CompletePayrollErganiDeclarationDto,
  CompletePayrollTerminationDto,
  CreatePayrollErganiDeclarationDto,
  CreatePayrollEventDto,
  CreatePayrollLeaveDto,
  CreatePayrollContractDto,
  CreatePayrollEmployeeDto,
  CreatePayrollTerminationDto,
  MarkContributionsPaidDto,
  MarkFmyPaidDto,
  MarkPayrollPaidDto,
  UpdatePayrollComplianceDeadlinesDto,
  UpdatePayrollContractDto,
  UpdatePayrollEmployeeDto,
  UpdatePayrollSicknessDto,
  UpsertPayrollEmployerSettingsDto,
} from './dto/payroll.dto';
import { PayrollService } from './payroll.service';

@ApiTags('payroll')
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get()
  workspace(
    @CurrentTenant() tenant: TenantContext,
    @Query('clientCompanyId') clientCompanyId: string,
  ) {
    return this.payrollService.getWorkspace(tenant, clientCompanyId);
  }

  @Post('employer-settings')
  @Roles(...OFFICE_WRITE_ROLES)
  upsertSettings(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: UpsertPayrollEmployerSettingsDto,
  ) {
    return this.payrollService.upsertEmployerSettings(tenant, dto);
  }

  @Post('employees')
  @Roles(...OFFICE_WRITE_ROLES)
  createEmployee(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreatePayrollEmployeeDto,
  ) {
    return this.payrollService.createEmployee(tenant, dto);
  }

  @Patch('employees/:id')
  @Roles(...OFFICE_WRITE_ROLES)
  updateEmployee(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdatePayrollEmployeeDto,
  ) {
    return this.payrollService.updateEmployee(tenant, id, dto);
  }

  @Post('contracts')
  @Roles(...OFFICE_WRITE_ROLES)
  createContract(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreatePayrollContractDto,
  ) {
    return this.payrollService.createContract(tenant, dto);
  }

  @Patch('contracts/:id')
  @Roles(...OFFICE_WRITE_ROLES)
  updateContract(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdatePayrollContractDto,
  ) {
    return this.payrollService.updateContract(tenant, id, dto);
  }

  @Delete('contracts/:id')
  @Roles(...OFFICE_WRITE_ROLES)
  deleteContract(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.payrollService.deleteContract(tenant, id);
  }

  @Post('ergani-declarations')
  @Roles(...OFFICE_WRITE_ROLES)
  createErganiDeclaration(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreatePayrollErganiDeclarationDto,
  ) {
    return this.payrollService.createErganiDeclaration(tenant, dto);
  }

  @Post('ergani-declarations/:id/complete')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  completeErganiDeclaration(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: CompletePayrollErganiDeclarationDto,
  ) {
    return this.payrollService.completeErganiDeclaration(tenant, id, dto);
  }

  @Delete('ergani-declarations/:id')
  @Roles(...OFFICE_WRITE_ROLES)
  deleteErganiDeclaration(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.payrollService.deleteErganiDeclaration(tenant, id);
  }

  @Post('events')
  @Roles(...OFFICE_WRITE_ROLES)
  createEvent(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreatePayrollEventDto,
  ) {
    return this.payrollService.createEvent(tenant, dto);
  }

  @Patch('events/:id/sickness')
  @Roles(...OFFICE_WRITE_ROLES)
  updateSickness(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdatePayrollSicknessDto,
  ) {
    return this.payrollService.updateSickness(tenant, id, dto);
  }

  @Delete('events/:id')
  @Roles(...OFFICE_WRITE_ROLES)
  deleteEvent(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.payrollService.deleteEvent(tenant, id);
  }

  @Post('leaves')
  @Roles(...OFFICE_WRITE_ROLES)
  createLeave(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreatePayrollLeaveDto,
  ) {
    return this.payrollService.createLeave(tenant, dto);
  }

  @Delete('leaves/:id')
  @Roles(...OFFICE_WRITE_ROLES)
  deleteLeave(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.payrollService.deleteLeave(tenant, id);
  }

  @Post('terminations')
  @Roles(...OFFICE_WRITE_ROLES)
  createTermination(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreatePayrollTerminationDto,
  ) {
    return this.payrollService.createTermination(tenant, dto);
  }

  @Post('terminations/:id/complete')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  completeTermination(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: CompletePayrollTerminationDto,
  ) {
    return this.payrollService.completeTermination(tenant, id, dto);
  }

  @Delete('terminations/:id')
  @Roles(...OFFICE_WRITE_ROLES)
  deleteTermination(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.payrollService.deleteTermination(tenant, id);
  }

  @Post('periods/calculate')
  @Roles(...OFFICE_WRITE_ROLES)
  calculate(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CalculatePayrollPeriodDto,
  ) {
    return this.payrollService.calculate(tenant, dto);
  }

  @Post('periods/:id/approve')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  approve(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.payrollService.approve(tenant, id);
  }

  @Post('periods/:id/paid')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  markPaid(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: MarkPayrollPaidDto,
  ) {
    return this.payrollService.markPaid(tenant, id, dto);
  }

  @Patch('periods/:id/compliance-deadlines')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  updateComplianceDeadlines(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdatePayrollComplianceDeadlinesDto,
  ) {
    return this.payrollService.updateComplianceDeadlines(tenant, id, dto);
  }

  @Post('periods/:id/apd-submission')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  completeApdSubmission(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: CompleteApdSubmissionDto,
  ) {
    return this.payrollService.completeApdSubmission(tenant, id, dto);
  }

  @Post('periods/:id/contributions-paid')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  markContributionsPaid(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: MarkContributionsPaidDto,
  ) {
    return this.payrollService.markContributionsPaid(tenant, id, dto);
  }

  @Post('periods/:id/teka-submission')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  completeTekaSubmission(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: CompleteApdSubmissionDto,
  ) {
    return this.payrollService.completeTekaSubmission(tenant, id, dto);
  }

  @Post('periods/:id/teka-paid')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  markTekaPaid(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: MarkContributionsPaidDto,
  ) {
    return this.payrollService.markTekaPaid(tenant, id, dto);
  }

  @Post('periods/:id/fmy-submission')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  completeFmySubmission(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: CompleteFmySubmissionDto,
  ) {
    return this.payrollService.completeFmySubmission(tenant, id, dto);
  }

  @Post('periods/:id/fmy-paid')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  markFmyPaid(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: MarkFmyPaidDto,
  ) {
    return this.payrollService.markFmyPaid(tenant, id, dto);
  }

  @Get('periods/:id/apd')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  async exportApd(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Res() response: Response,
  ) {
    const result = await this.payrollService.exportApd(tenant, id);
    response.setHeader('Content-Type', 'application/octet-stream');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename.replace(/[^A-Za-z0-9._-]/g, '_')}"`,
    );
    response.send(result.buffer);
  }

  @Get('periods/:id/payslips/:entryId')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  async exportPayslip(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Param('entryId') entryId: string,
    @Res() response: Response,
  ) {
    const result = await this.payrollService.exportPayslip(tenant, id, entryId);
    this.sendDownload(response, result);
  }

  @Get('periods/:id/bank-payments')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  async exportBankPayments(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Res() response: Response,
  ) {
    const result = await this.payrollService.exportBankPayments(tenant, id);
    this.sendDownload(response, result);
  }

  @Get('periods/:id/withholding-workpaper')
  @Roles(...ACCOUNTING_CONTROL_ROLES)
  async exportWithholdingWorkpaper(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Res() response: Response,
  ) {
    const result = await this.payrollService.exportWithholdingWorkpaper(tenant, id);
    this.sendDownload(response, result);
  }

  private sendDownload(
    response: Response,
    result: { buffer: Buffer; filename: string; contentType: string },
  ) {
    response.setHeader('Content-Type', result.contentType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename.replace(/[^A-Za-z0-9._-]/g, '_')}"`,
    );
    response.send(result.buffer);
  }
}
