import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { AdminRole, LocationTier } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@Controller('api/locations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LocationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(
    @Query('tier') tier?: LocationTier,
    @Query('isActive') isActive?: string,
  ) {
    return this.prisma.location.findMany({
      where: {
        ...(tier ? { tier } : {}),
        ...(isActive !== undefined ? { isActive: isActive === 'true' } : {}),
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const loc = await this.prisma.location.findUnique({ where: { id } });
    if (!loc) throw new NotFoundException('Location not found');
    return loc;
  }

  @Post()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async create(
    @Body() dto: CreateLocationDto,
    @CurrentAdmin() admin: any,
  ) {
    const loc = await this.prisma.location.create({
      data: {
        name: dto.name,
        tier: dto.tier,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive ?? true,
      },
    });
    await this.audit.log(admin.id, 'location.create', loc.id, { name: dto.name });
    return loc;
  }

  @Patch(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
    @CurrentAdmin() admin: any,
  ) {
    const loc = await this.prisma.location.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.tier !== undefined ? { tier: dto.tier } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    await this.audit.log(admin.id, 'location.update', id, { ...dto });
    return loc;
  }

  @Delete(':id')
  @Roles(AdminRole.SUPER_ADMIN)
  async remove(@Param('id') id: string, @CurrentAdmin() admin: any) {
    // Soft delete
    const loc = await this.prisma.location.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit.log(admin.id, 'location.deactivate', id);
    return loc;
  }
}
