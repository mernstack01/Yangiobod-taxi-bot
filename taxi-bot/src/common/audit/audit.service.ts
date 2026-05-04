import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    adminId: string,
    action: string,
    targetId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        adminId,
        action,
        targetId,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
