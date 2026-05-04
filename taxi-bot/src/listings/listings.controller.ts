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
import { AdminRole, ListingStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { IsEnum, IsOptional, IsString } from 'class-validator';

class CloseListingDto {
  @IsString()
  @IsOptional()
  reason?: string;
}

class UpdateListingStatusDto {
  @IsEnum(ListingStatus)
  status!: ListingStatus;

  @IsString()
  @IsOptional()
  reason?: string;
}

@Controller('api/listings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ListingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MODERATOR)
  list(
    @Query('status') status?: ListingStatus,
    @Query('fromId') fromId?: string,
    @Query('toId') toId?: string,
    @Query('clientId') clientId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    const take = Math.min(parseInt(limit) || 50, 200);
    const skip = (Math.max(parseInt(page) || 1, 1) - 1) * take;

    return this.prisma.listing.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(fromId ? { fromId } : {}),
        ...(toId ? { toId } : {}),
        ...(clientId ? { clientId } : {}),
      },
      include: {
        client: true,
        from: true,
        to: true,
        matchedDriver: { include: { user: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  @Get(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MODERATOR)
  async findOne(@Param('id') id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        client: true,
        from: true,
        to: true,
        matchedDriver: { include: { user: true } },
      },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    return listing;
  }

  @Patch(':id/status')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateListingStatusDto,
    @CurrentAdmin() admin: any,
  ) {
    const listing = await this.prisma.listing.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.status === ListingStatus.CLOSED || dto.status === ListingStatus.CANCELLED
          ? { closedAt: new Date(), closedReason: dto.reason }
          : {}),
      },
    });
    await this.audit.log(admin.id, 'listing.status_change', id, { status: dto.status, reason: dto.reason });
    return listing;
  }

  @Delete(':id')
  @Roles(AdminRole.SUPER_ADMIN)
  async remove(@Param('id') id: string, @CurrentAdmin() admin: any) {
    const listing = await this.prisma.listing.update({
      where: { id },
      data: { status: ListingStatus.CANCELLED, closedAt: new Date(), closedReason: 'Admin cancelled' },
    });
    await this.audit.log(admin.id, 'listing.cancel', id);
    return listing;
  }
}
