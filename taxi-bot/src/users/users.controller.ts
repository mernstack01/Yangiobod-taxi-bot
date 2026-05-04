import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { AdminRole, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

class UpdateUserDto {
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @IsBoolean()
  @IsOptional()
  isBlocked?: boolean;

  @IsString()
  @IsOptional()
  phone?: string;
}

class BlockUserDto {
  @IsString()
  reason!: string;
}

@Controller('api/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MODERATOR)
  list(
    @Query('role') role?: UserRole,
    @Query('isBlocked') isBlocked?: string,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    const take = Math.min(parseInt(limit) || 50, 200);
    const skip = (Math.max(parseInt(page) || 1, 1) - 1) * take;

    return this.prisma.user.findMany({
      where: {
        ...(role ? { role } : {}),
        ...(isBlocked !== undefined ? { isBlocked: isBlocked === 'true' } : {}),
        ...(search
          ? {
              OR: [
                { username: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
              ],
            }
          : {}),
      },
      include: { driver: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  @Get(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MODERATOR)
  async findOne(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { driver: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  @Patch(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentAdmin() admin: any,
  ) {
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.isBlocked !== undefined ? { isBlocked: dto.isBlocked } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      },
    });
    await this.audit.log(admin.id, 'user.update', id, { ...dto });
    return user;
  }

  @Patch(':id/block')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MODERATOR)
  async block(
    @Param('id') id: string,
    @Body() dto: BlockUserDto,
    @CurrentAdmin() admin: any,
  ) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { isBlocked: true },
    });
    await this.prisma.blockHistory.create({
      data: { userId: id, blockedById: admin.id, reason: dto.reason },
    });
    await this.audit.log(admin.id, 'user.block', id, { reason: dto.reason });
    return user;
  }

  @Patch(':id/unblock')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MODERATOR)
  async unblock(@Param('id') id: string, @CurrentAdmin() admin: any) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { isBlocked: false },
    });
    await this.prisma.blockHistory.updateMany({
      where: { userId: id, unblockedAt: null },
      data: { unblockedAt: new Date() },
    });
    await this.audit.log(admin.id, 'user.unblock', id);
    return user;
  }

  @Delete(':id')
  @Roles(AdminRole.SUPER_ADMIN)
  async remove(@Param('id') id: string, @CurrentAdmin() admin: any) {
    await this.prisma.user.delete({ where: { id } });
    await this.audit.log(admin.id, 'user.delete', id);
    return { deleted: true };
  }
}
