import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AdminUser } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; admin: Omit<AdminUser, 'passwordHash'> }> {
    const admin = await this.prisma.adminUser.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });

    if (!admin || !admin.isActive) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const payload = { sub: admin.id, email: admin.email, role: admin.role };
    const accessToken = this.jwt.sign(payload);

    const { passwordHash: _, ...adminData } = admin;
    return { accessToken, admin: adminData };
  }

  async getAdminById(adminId: string): Promise<AdminUser | null> {
    return this.prisma.adminUser.findUnique({ where: { id: adminId } });
  }

  async changePassword(
    adminId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const admin = await this.prisma.adminUser.findUniqueOrThrow({ where: { id: adminId } });
    const valid = await bcrypt.compare(oldPassword, admin.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.adminUser.update({ where: { id: adminId }, data: { passwordHash } });
  }

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 12);
  }
}
