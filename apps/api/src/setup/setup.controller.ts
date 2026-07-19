import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service';
import { Public } from '../auth/public.decorator';
import { InitialSetupDto } from './dto/initial-setup.dto';
import { SetupService } from './setup.service';

@ApiTags('setup')
@Controller('setup')
export class SetupController {
  constructor(
    private readonly setupService: SetupService,
    private readonly authService: AuthService,
  ) {}

  @Public()
  @Get('status')
  status() {
    return this.setupService.status();
  }

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async initialize(@Body() dto: InitialSetupDto) {
    await this.setupService.initialize(dto);
    return this.authService.login(dto.adminEmail, dto.adminPassword);
  }
}
