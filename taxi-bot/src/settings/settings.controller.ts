import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { IsString } from 'class-validator';

class UpsertSettingDto {
  @IsString()
  value!: string;
}

@Controller('api/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  list() {
    return this.prisma.appSetting.findMany({ orderBy: { key: 'asc' } });
  }

  @Get(':key')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async findOne(@Param('key') key: string) {
    const setting = await this.prisma.appSetting.findUnique({ where: { key } });
    return setting ?? { key, value: null };
  }

  @Put(':key')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async upsert(
    @Param('key') key: string,
    @Body() dto: UpsertSettingDto,
    @CurrentAdmin() admin: any,
  ) {
    const setting = await this.prisma.appSetting.upsert({
      where: { key },
      create: { key, value: dto.value },
      update: { value: dto.value },
    });
    await this.audit.log(admin.id, 'setting.upsert', key, { value: dto.value });
    return setting;
  }
}
