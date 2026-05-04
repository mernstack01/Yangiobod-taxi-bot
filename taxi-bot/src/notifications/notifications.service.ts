import { Injectable, Logger } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { BotService } from '../bot/bot.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly botService: BotService) {}

  async sendToUser(telegramId: number, text: string): Promise<void> {
    try {
      await this.botService.bot.api.sendMessage(telegramId, text, {
        parse_mode: 'HTML',
      });
    } catch (err) {
      this.logger.error(`Failed to send message to ${telegramId}`, err);
    }
  }

  async sendToUserWithKeyboard(
    telegramId: number,
    text: string,
    keyboard: InlineKeyboard,
  ): Promise<void> {
    try {
      await this.botService.bot.api.sendMessage(telegramId, text, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } catch (err) {
      this.logger.error(`Failed to send message to ${telegramId}`, err);
    }
  }

  async sendToMany(telegramIds: number[], text: string): Promise<void> {
    await Promise.allSettled(
      telegramIds.map((id) => this.sendToUser(id, text)),
    );
  }
}

export function formatDeparture(date: Date): string {
  const now = new Date();
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const timeStr = `${h}:${m}`;
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  return isToday
    ? `Bugun ${timeStr}`
    : `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')} ${timeStr}`;
}
