import { Injectable } from '@nestjs/common';
import { Driver, DriverStatus, Prisma, RegistrationStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

export type DriverWithUser = Prisma.DriverGetPayload<{ include: { user: true } }>;

@Injectable()
export class DriversService {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<Driver | null> {
    return this.prisma.driver.findUnique({ where: { userId } });
  }

  async register(data: {
    userId: string;
    carModel: string;
    carNumber: string;
    carColor?: string;
  }): Promise<Driver> {
    return this.prisma.driver.create({
      data: { ...data, status: RegistrationStatus.ACTIVE },
    });
  }

  // Update the driver's registration/approval status
  async setStatus(driverId: string, status: RegistrationStatus): Promise<Driver> {
    return this.prisma.driver.update({
      where: { id: driverId },
      data: { status },
    });
  }

  // Update driver's real-time availability for dispatching
  async updateAvailability(
    driverId: string,
    data: {
      currentStatus: DriverStatus;
      currentLocationId?: string | null;
      availableSeats?: number;
      acceptsParcel?: boolean;
    },
  ): Promise<Driver> {
    return this.prisma.driver.update({
      where: { id: driverId },
      data: {
        currentStatus: data.currentStatus,
        currentLocationId: data.currentLocationId,
        availableSeats: data.availableSeats ?? 0,
        acceptsParcel: data.acceptsParcel ?? false,
        statusUpdatedAt: new Date(),
      },
    });
  }

  // Aggregate available drivers by their current location
  async getAvailableCountsByLocation(): Promise<
    Array<{ locationId: string; locationName: string; driverCount: number; totalSeats: number }>
  > {
    const drivers = await this.prisma.driver.findMany({
      where: {
        status: RegistrationStatus.ACTIVE,
        currentStatus: DriverStatus.AVAILABLE,
      },
      include: { currentLocation: true },
    });

    const groups = new Map<
      string,
      { locationName: string; driverCount: number; totalSeats: number }
    >();

    for (const driver of drivers) {
      if (!driver.currentLocation) continue;
      const locId = driver.currentLocationId!;
      if (!groups.has(locId)) {
        groups.set(locId, { locationName: driver.currentLocation.name, driverCount: 0, totalSeats: 0 });
      }
      const g = groups.get(locId)!;
      g.driverCount++;
      g.totalSeats += driver.availableSeats;
    }

    return Array.from(groups.entries()).map(([locationId, data]) => ({ locationId, ...data }));
  }

  // Get drivers available in a specific location with enough seats
  async getAvailableInLocation(locationId: string, minSeats = 1): Promise<DriverWithUser[]> {
    return this.prisma.driver.findMany({
      where: {
        status: RegistrationStatus.ACTIVE,
        currentStatus: DriverStatus.AVAILABLE,
        currentLocationId: locationId,
        availableSeats: { gte: minSeats },
      },
      include: { user: true },
    });
  }
}
