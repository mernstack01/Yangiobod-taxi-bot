import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InlineKeyboard } from 'grammy';
import { ListingStatus, NeedTime } from '@prisma/client';
import { BotService } from '../bot/bot.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { ListingsService, ListingWithRelations } from '../listings/listings.service';

@Injectable()
export class TopicBroadcasterService {
  private readonly logger = new Logger(TopicBroadcasterService.name);

  constructor(
    private readonly botService: BotService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly listingsService: ListingsService,
  ) {}

  async broadcastListing(listingId: string): Promise<{
    success: boolean;
    topicId?: number;
    messageId?: number;
    error?: string;
  }> {
    const listing = await this.listingsService.findById(listingId);
    if (!listing) return { success: false, error: 'Listing not found' };

    const groupId = await this.getActiveGroupId();
    if (!groupId) {
      this.logger.warn('No active group configured — skipping broadcast');
      return { success: false, error: 'No group configured' };
    }

    // Try destination topic first, fall back to origin topic
    const topic = await this.resolveTopicForListing(listing);
    if (!topic) {
      this.logger.warn(
        `No active topic for listing ${listingId} (from=${listing.fromId}, to=${listing.toId})`,
      );
      return { success: false, error: 'No active topic for this route' };
    }

    try {
      const text = this.formatListingMessage(listing);
      const keyboard = this.buildResponseKeyboard(listingId);

      const msg = await this.botService.bot.api.sendMessage(groupId, text, {
        parse_mode: 'HTML',
        message_thread_id: topic.topicId,
        reply_markup: keyboard,
      });

      await this.listingsService.setBroadcastInfo(listingId, topic.topicId, msg.message_id);
      this.logger.log(`Broadcast listing ${listingId} to topic ${topic.topicId}, msg ${msg.message_id}`);

      return { success: true, topicId: topic.topicId, messageId: msg.message_id };
    } catch (err: any) {
      this.logger.error(`Failed to broadcast listing ${listingId}: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async updateBroadcast(
    listingId: string,
    newStatus: 'MATCHED' | 'CLOSED' | 'EXPIRED',
  ): Promise<void> {
    const listing = await this.listingsService.findById(listingId);
    if (!listing || !listing.topicId || !listing.messageId) return;

    const groupId = await this.getActiveGroupId();
    if (!groupId) return;

    const text = this.formatClosedMessage(listing, newStatus);

    try {
      await this.botService.bot.api.editMessageText(groupId, listing.messageId, text, {
        parse_mode: 'HTML',
      });
    } catch (err: any) {
      // Message might be too old to edit — that's fine
      this.logger.warn(`Could not update broadcast for ${listingId}: ${err.message}`);
    }
  }

  async deleteBroadcast(listingId: string): Promise<void> {
    const listing = await this.listingsService.findById(listingId);
    if (!listing || !listing.messageId) return;

    const groupId = await this.getActiveGroupId();
    if (!groupId) return;

    try {
      await this.botService.bot.api.deleteMessage(groupId, listing.messageId);
    } catch (err: any) {
      this.logger.warn(`Could not delete broadcast for ${listingId}: ${err.message}`);
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async getActiveGroupId(): Promise<number | null> {
    const configGroupId = this.config.get<number | null>('bot.groupId', null);
    if (configGroupId) return configGroupId;

    const group = await this.prisma.groupConfig.findFirst({ where: { isActive: true } });
    return group ? Number(group.groupId) : null;
  }

  private async resolveTopicForListing(
    listing: ListingWithRelations,
  ): Promise<{ topicId: number } | null> {
    // Broadcast to the origin topic — drivers currently IN that location see it
    const fromTopic = await this.prisma.topic.findUnique({
      where: { locationId: listing.fromId },
    });
    if (fromTopic?.isActive && fromTopic.topicId > 0) return fromTopic;

    // Fall back to destination topic
    const toTopic = await this.prisma.topic.findUnique({
      where: { locationId: listing.toId },
    });
    if (toTopic?.isActive && toTopic.topicId > 0) return toTopic;

    return null;
  }

  private formatListingMessage(listing: ListingWithRelations, status?: string): string {
    const lines: string[] = ['🚖 <b>Yangi e\'lon</b>', ''];
    lines.push(`📍 <b>${listing.from.name} → ${listing.to.name}</b>`);

    if (listing.parcelOnly) {
      lines.push('📦 Faqat pochta');
    } else {
      lines.push(`👥 ${listing.passengerCount} kishi`);
      if (listing.acceptsParcel) lines.push('📦 Pochta ham bor');
    }

    lines.push(`⏰ ${formatNeedTime(listing.needTime, listing.scheduledAt)}`);

    if (listing.priceOffer) {
      lines.push(`💰 ${listing.priceOffer.toLocaleString()} so'm`);
    } else {
      lines.push('💰 Kelishiladi');
    }

    if (listing.comment) lines.push(`💬 ${listing.comment}`);

    lines.push('');
    lines.push(`#E${listing.id.slice(-5).toUpperCase()}`);

    if (status) {
      lines.unshift(`<i>${status}</i>`);
      lines.unshift('');
    }

    return lines.join('\n');
  }

  private formatClosedMessage(
    listing: ListingWithRelations,
    status: 'MATCHED' | 'CLOSED' | 'EXPIRED',
  ): string {
    const statusLine =
      status === 'MATCHED'
        ? '✅ <b>Yopildi — haydovchi topildi</b>'
        : status === 'CLOSED'
          ? '✅ <b>Yopildi — mijoz tomonidan</b>'
          : '⏰ <b>Muddati tugadi</b>';

    return `${statusLine}\n📍 ${listing.from.name} → ${listing.to.name}`;
  }

  private buildResponseKeyboard(listingId: string): InlineKeyboard {
    return new InlineKeyboard().text('🚗 Men kelaman', `respond_listing:${listingId}`);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function formatNeedTime(needTime: NeedTime, scheduledAt?: Date | null): string {
  switch (needTime) {
    case NeedTime.NOW:
      return 'Hozir';
    case NeedTime.IN_15_MIN:
      return '15 daqiqada';
    case NeedTime.IN_30_MIN:
      return '30 daqiqada';
    case NeedTime.IN_1_HOUR:
      return '1 soatda';
    case NeedTime.SCHEDULED:
      if (scheduledAt) {
        const h = String(scheduledAt.getHours()).padStart(2, '0');
        const m = String(scheduledAt.getMinutes()).padStart(2, '0');
        return `${h}:${m}`;
      }
      return 'Belgilangan vaqt';
  }
}
