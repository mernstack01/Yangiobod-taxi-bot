import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminRole, DriverStatus, ListingStatus, RegistrationStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../common/prisma/prisma.service';

@Controller('api/stats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MODERATOR)
export class StatsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('overview')
  async overview() {
    const [
      totalUsers,
      blockedUsers,
      totalDrivers,
      pendingDrivers,
      activeDrivers,
      onlineDrivers,
      totalListings,
      activeListings,
      matchedToday,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isBlocked: true } }),
      this.prisma.driver.count(),
      this.prisma.driver.count({ where: { status: RegistrationStatus.PENDING } }),
      this.prisma.driver.count({ where: { status: RegistrationStatus.ACTIVE } }),
      this.prisma.driver.count({ where: { currentStatus: DriverStatus.AVAILABLE } }),
      this.prisma.listing.count(),
      this.prisma.listing.count({ where: { status: ListingStatus.ACTIVE } }),
      this.prisma.listing.count({
        where: {
          status: ListingStatus.MATCHED,
          matchedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ]);

    return {
      users: { total: totalUsers, blocked: blockedUsers },
      drivers: { total: totalDrivers, pending: pendingDrivers, active: activeDrivers, online: onlineDrivers },
      listings: { total: totalListings, active: activeListings, matchedToday },
    };
  }

  @Get('listings-by-route')
  async listingsByRoute(@Query('days') days = '7') {
    const since = new Date();
    since.setDate(since.getDate() - Math.min(parseInt(days) || 7, 90));

    const listings = await this.prisma.listing.groupBy({
      by: ['fromId', 'toId'],
      where: { createdAt: { gte: since } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 20,
    });

    const locationIds = [...new Set(listings.flatMap((l) => [l.fromId, l.toId]))];
    const locations = await this.prisma.location.findMany({
      where: { id: { in: locationIds } },
      select: { id: true, name: true },
    });
    const locMap = new Map(locations.map((l) => [l.id, l.name]));

    return listings.map((l) => ({
      from: locMap.get(l.fromId) ?? l.fromId,
      to: locMap.get(l.toId) ?? l.toId,
      count: l._count.id,
    }));
  }

  @Get('drivers-by-location')
  async driversByLocation() {
    const drivers = await this.prisma.driver.findMany({
      where: {
        status: RegistrationStatus.ACTIVE,
        currentStatus: DriverStatus.AVAILABLE,
        currentLocationId: { not: null },
      },
      include: { currentLocation: { select: { id: true, name: true } } },
    });

    const groups = new Map<string, { name: string; count: number; seats: number }>();
    for (const d of drivers) {
      if (!d.currentLocation) continue;
      const locId = d.currentLocationId!;
      if (!groups.has(locId)) groups.set(locId, { name: d.currentLocation.name, count: 0, seats: 0 });
      const g = groups.get(locId)!;
      g.count++;
      g.seats += d.availableSeats;
    }

    return Array.from(groups.entries()).map(([id, data]) => ({ locationId: id, ...data }));
  }
}
