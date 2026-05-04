import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

class CreateTopicDto {
  @IsString()
  locationId!: string;

  @IsInt()
  topicId!: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

class UpdateTopicDto {
  @IsInt()
  @IsOptional()
  topicId?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

@Controller('api/topics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TopicsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list() {
    return this.prisma.topic.findMany({
      include: { location: true },
      orderBy: { location: { sortOrder: 'asc' } },
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { id },
      include: { location: true },
    });
    if (!topic) throw new NotFoundException('Topic not found');
    return topic;
  }

  @Post()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async create(@Body() dto: CreateTopicDto, @CurrentAdmin() admin: any) {
    const topic = await this.prisma.topic.create({
      data: {
        locationId: dto.locationId,
        topicId: dto.topicId,
        isActive: dto.isActive ?? true,
      },
      include: { location: true },
    });
    await this.audit.log(admin.id, 'topic.create', topic.id, { locationId: dto.locationId, topicId: dto.topicId });
    return topic;
  }

  @Patch(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTopicDto,
    @CurrentAdmin() admin: any,
  ) {
    const topic = await this.prisma.topic.update({
      where: { id },
      data: {
        ...(dto.topicId !== undefined ? { topicId: dto.topicId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: { location: true },
    });
    await this.audit.log(admin.id, 'topic.update', id, { ...dto });
    return topic;
  }

  @Delete(':id')
  @Roles(AdminRole.SUPER_ADMIN)
  async remove(@Param('id') id: string, @CurrentAdmin() admin: any) {
    await this.prisma.topic.delete({ where: { id } });
    await this.audit.log(admin.id, 'topic.delete', id);
    return { deleted: true };
  }
}
