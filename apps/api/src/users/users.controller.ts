import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ADMIN_ROLES } from '../auth/role-groups';
import { Roles } from '../auth/roles.decorator';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { TenantContext } from '../common/tenant/tenant-context';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
@Roles(...ADMIN_ROLES)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@CurrentTenant() tenant: TenantContext) {
    return this.usersService.findAll(tenant);
  }

  @Post()
  create(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateUserDto) {
    return this.usersService.create(tenant, dto);
  }

  @Patch(':id')
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(tenant, id, dto);
  }

  @Post(':id/disable')
  disable(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.usersService.disable(tenant, id);
  }

  @Post(':id/enable')
  enable(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.usersService.enable(tenant, id);
  }
}
