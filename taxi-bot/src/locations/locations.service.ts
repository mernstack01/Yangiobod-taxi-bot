import { Injectable } from '@nestjs/common';
import { Location, LocationTier, Route } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

export interface Coordinates {
  lat: number;
  lon: number;
}

export type RouteWithEndpoints = Route & {
  from: Location;
  to: Location;
};

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Location[]> {
    return this.prisma.location.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findByTier(tier: LocationTier): Promise<Location[]> {
    return this.prisma.location.findMany({
      where: { isActive: true, tier },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findRoute(fromId: string, toId: string): Promise<RouteWithEndpoints | null> {
    return this.prisma.route.findUnique({
      where: { fromId_toId: { fromId, toId } },
      include: { from: true, to: true },
    });
  }

  async getRouteStops(fromId: string, toId: string): Promise<Location[]> {
    const route = await this.prisma.route.findUnique({
      where: { fromId_toId: { fromId, toId } },
    });

    if (!route || route.stops.length === 0) return [];

    const locations = await this.prisma.location.findMany({
      where: { id: { in: route.stops } },
    });

    // Preserve the ordered sequence defined in route.stops
    return route.stops
      .map((id) => locations.find((l) => l.id === id))
      .filter((l): l is Location => l !== undefined);
  }

  distanceKm(a: Coordinates, b: Coordinates): number {
    const R = 6371;
    const dLat = this.toRad(b.lat - a.lat);
    const dLon = this.toRad(b.lon - a.lon);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const x =
      sinDLat * sinDLat +
      Math.cos(this.toRad(a.lat)) *
        Math.cos(this.toRad(b.lat)) *
        sinDLon *
        sinDLon;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }
}
