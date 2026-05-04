import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Listing, ListingStatus, NeedTime, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

export interface CreateListingData {
  clientId: string;
  fromId: string;
  toId: string;
  passengerCount: number;
  acceptsParcel: boolean;
  parcelOnly: boolean;
  needTime: NeedTime;
  scheduledAt?: Date;
  priceOffer?: number;
  comment?: string;
}

// Full listing with all relations needed for display and broadcasting
export type ListingWithRelations = Prisma.ListingGetPayload<{
  include: {
    client: true;
    from: true;
    to: true;
    matchedDriver: { include: { user: true } };
  };
}>;

const LISTING_INCLUDE = {
  client: true,
  from: true,
  to: true,
  matchedDriver: { include: { user: true } },
} as const;

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async createListing(data: CreateListingData): Promise<ListingWithRelations> {
    const expiryHours = this.config.get<number>('listing.expiryHours', 2);
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

    return this.prisma.listing.create({
      data: {
        clientId: data.clientId,
        fromId: data.fromId,
        toId: data.toId,
        passengerCount: data.passengerCount,
        acceptsParcel: data.acceptsParcel,
        parcelOnly: data.parcelOnly,
        needTime: data.needTime,
        scheduledAt: data.scheduledAt,
        priceOffer: data.priceOffer,
        comment: data.comment,
        expiresAt,
      },
      include: LISTING_INCLUDE,
    });
  }

  async findById(id: string): Promise<ListingWithRelations | null> {
    return this.prisma.listing.findUnique({ where: { id }, include: LISTING_INCLUDE });
  }

  async setBroadcastInfo(listingId: string, topicId: number, messageId: number): Promise<void> {
    await this.prisma.listing.update({
      where: { id: listingId },
      data: { topicId, messageId },
    });
  }

  async matchWithDriver(listingId: string, driverId: string): Promise<ListingWithRelations> {
    return this.prisma.listing.update({
      where: { id: listingId },
      data: {
        status: ListingStatus.MATCHED,
        matchedDriverId: driverId,
        matchedAt: new Date(),
      },
      include: LISTING_INCLUDE,
    });
  }

  async closeListing(listingId: string, reason: string): Promise<ListingWithRelations> {
    return this.prisma.listing.update({
      where: { id: listingId },
      data: {
        status: ListingStatus.CLOSED,
        closedAt: new Date(),
        closedReason: reason,
      },
      include: LISTING_INCLUDE,
    });
  }

  async cancelListing(listingId: string, clientId: string): Promise<ListingWithRelations> {
    return this.prisma.listing.update({
      where: { id: listingId, clientId },
      data: { status: ListingStatus.CANCELLED },
      include: LISTING_INCLUDE,
    });
  }

  async getClientActiveListings(clientId: string): Promise<ListingWithRelations[]> {
    return this.prisma.listing.findMany({
      where: {
        clientId,
        status: ListingStatus.ACTIVE,
        expiresAt: { gt: new Date() },
      },
      include: LISTING_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async canClientCreateListing(clientId: string): Promise<{ allowed: boolean; waitMinutes?: number }> {
    const cooldownMinutes = this.config.get<number>('listing.clientCooldownMinutes', 10);
    const since = new Date(Date.now() - cooldownMinutes * 60 * 1000);

    const recent = await this.prisma.listing.findFirst({
      where: {
        clientId,
        createdAt: { gt: since },
        status: { not: ListingStatus.CANCELLED },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!recent) return { allowed: true };

    const waitMs = recent.createdAt.getTime() + cooldownMinutes * 60 * 1000 - Date.now();
    const waitMinutes = Math.ceil(waitMs / 60000);
    return { allowed: false, waitMinutes };
  }

  // Returns IDs of listings that were expired so the cron job can update broadcasts
  async expireOldListings(): Promise<string[]> {
    const toExpire = await this.prisma.listing.findMany({
      where: { status: ListingStatus.ACTIVE, expiresAt: { lte: new Date() } },
      select: { id: true },
    });

    if (toExpire.length === 0) return [];

    const ids = toExpire.map((l) => l.id);
    await this.prisma.listing.updateMany({
      where: { id: { in: ids } },
      data: { status: ListingStatus.EXPIRED },
    });

    this.logger.log(`Expired ${ids.length} listings`);
    return ids;
  }
}
