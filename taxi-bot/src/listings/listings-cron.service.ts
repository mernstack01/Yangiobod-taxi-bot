import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ListingsService } from './listings.service';

// Lazy injection via forwardRef is used because TopicBroadcasterService lives in
// NotificationsModule which imports ListingsModule — we break the circle with a token.
// For simplicity we defer the broadcaster via the NestJS module system instead.
@Injectable()
export class ListingsCronService {
  private readonly logger = new Logger(ListingsCronService.name);

  // Broadcaster is injected optionally at runtime via setter to avoid circular deps.
  // BotModule → NotificationsModule → TopicBroadcasterService needs ListingsService,
  // and ListingsModule → ListingsCronService needs TopicBroadcasterService.
  // We resolve this by injecting broadcaster lazily from BotUpdate after startup.
  private broadcaster: { updateBroadcast(id: string, s: 'EXPIRED'): Promise<void> } | null = null;

  constructor(private readonly listingsService: ListingsService) {}

  setBroadcaster(b: { updateBroadcast(id: string, s: 'EXPIRED'): Promise<void> }): void {
    this.broadcaster = b;
  }

  @Cron('0 */5 * * * *')
  async handleExpiredListings(): Promise<void> {
    const expiredIds = await this.listingsService.expireOldListings();

    if (expiredIds.length === 0) return;
    this.logger.log(`Expired ${expiredIds.length} listings, updating broadcasts`);

    if (!this.broadcaster) return;

    await Promise.allSettled(
      expiredIds.map((id) => this.broadcaster!.updateBroadcast(id, 'EXPIRED')),
    );
  }
}
