import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { AdminRole, RegistrationStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { IsEnum, IsOptional, IsString } from 'class-validator';

class UpdateDriverDto {
  @IsEnum(RegistrationStatus)
  @IsOptional()
  status?: RegistrationStatus;

  @IsString()
  @IsOptional()
  carModel?: string;

  @IsString()
  @IsOptional()
  carNumber?: string;

  @IsString()
  @IsOptional()
  carColor?: string;
}

@Controller('api/drivers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DriversController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MODERATOR)
  list(
    @Query('status') status?: RegistrationStatus,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    const take = Math.min(parseInt(limit) || 50, 200);
    const skip = (Math.max(parseInt(page) || 1, 1) - 1) * take;

    return this.prisma.driver.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { carNumber: { contains: search, mode: 'insensitive' } },
                { carModel: { contains: search, mode: 'insensitive' } },
                { user: { firstName: { contains: search, mode: 'insensitive' } } },
                { user: { username: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: { user: true, currentLocation: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  @Get(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MODERATOR)
  async findOne(@Param('id') id: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id },
      include: { user: true, currentLocation: true },
    });
    if (!driver) throw new NotFoundException('Driver not found');
    return driver;
  }

  @Patch(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDriverDto,
    @CurrentAdmin() admin: any,
  ) {
    const driver = await this.prisma.driver.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.carModel !== undefined ? { carModel: dto.carModel } : {}),
        ...(dto.carNumber !== undefined ? { carNumber: dto.carNumber } : {}),
        ...(dto.carColor !== undefined ? { carColor: dto.carColor } : {}),
      },
    });
    await this.audit.log(admin.id, 'driver.update', id, { ...dto });
    return driver;
  }

  @Patch(':id/approve')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async approve(@Param('id') id: string, @CurrentAdmin() admin: any) {
    const driver = await this.prisma.driver.update({
      where: { id },
      data: { status: RegistrationStatus.ACTIVE },
    });
    await this.audit.log(admin.id, 'driver.approve', id);
    return driver;
  }

  @Patch(':id/block')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async block(@Param('id') id: string, @CurrentAdmin() admin: any) {
    const driver = await this.prisma.driver.update({
      where: { id },
      data: { status: RegistrationStatus.BLOCKED },
    });
    await this.audit.log(admin.id, 'driver.block', id);
    return driver;
  }
}
