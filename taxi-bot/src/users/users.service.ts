import { Injectable } from '@nestjs/common';
import { Prisma, User, UserRole } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

export type UserWithDriver = Prisma.UserGetPayload<{ include: { driver: true } }>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateByTelegramId(
    telegramId: bigint,
    data: { firstName: string; lastName?: string; username?: string },
  ): Promise<UserWithDriver> {
    return this.prisma.user.upsert({
      where: { telegramId },
      update: {
        firstName: data.firstName,
        lastName: data.lastName,
        username: data.username,
        lastActiveAt: new Date(),
      },
      create: {
        telegramId,
        firstName: data.firstName,
        lastName: data.lastName,
        username: data.username,
        role: UserRole.CLIENT,
        lastActiveAt: new Date(),
      },
      include: { driver: true },
    });
  }

  async getById(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  async setRole(userId: string, role: UserRole): Promise<User> {
    return this.prisma.user.update({ where: { id: userId }, data: { role } });
  }

  async updatePhone(userId: string, phone: string): Promise<User> {
    return this.prisma.user.update({ where: { id: userId }, data: { phone } });
  }
}
