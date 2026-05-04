import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createConversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import { ListingStatus, RegistrationStatus, UserRole } from '@prisma/client';

import { BotService } from './bot.service';
import { UsersService } from '../users/users.service';
import { DriversService } from '../drivers/drivers.service';
import { ListingsService } from '../listings/listings.service';
import { ListingsCronService } from '../listings/listings-cron.service';
import { LocationsService } from '../locations/locations.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TopicBroadcasterService } from '../notifications/topic-broadcaster.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { buildMainMenu, buildReplyKeyboard } from './keyboards/main-menu.keyboard';
import { createRegisterDriverScene } from './scenes/register-driver.scene';
import { createRequestTaxiScene } from './scenes/create-listing.scene';
import { createSetDriverStatusScene } from './scenes/driver-status.scene';
import { formatNeedTime } from '../notifications/topic-broadcaster.service';
import { NeedTime } from '@prisma/client';

// Reply keyboard button labels — must match exactly
const BTN = {
  REQUEST_TAXI:    "🚖 Taksi so'rash",
  AVAILABLE_TAXIS: "📊 Bo'sh taxilar",
  BECOME_DRIVER:   "🚗 Haydovchi bo'lish",
  DRIVER_STATUS:   ['🔴 Holat: Yopiq — yoqish', "🟢 Holat: Bo'shman", "🚗 Holat: Yo'ldaman", '☕ Holat: Tanaffus'],
  MY_LISTINGS:     "📋 Mening e'lonlarim",
  PROFILE:         '👤 Profil',
  PENDING_INFO:    '⏳ Ariza holati',
  GROUP:           '📢 Guruh',
} as const;

@Injectable()
export class BotUpdate implements OnModuleInit {
  private readonly logger = new Logger(BotUpdate.name);

  constructor(
    private readonly botService: BotService,
    private readonly usersService: UsersService,
    private readonly driversService: DriversService,
    private readonly listingsService: ListingsService,
    private readonly listingsCron: ListingsCronService,
    private readonly locationsService: LocationsService,
    private readonly notificationsService: NotificationsService,
    private readonly topicBroadcaster: TopicBroadcasterService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const { bot } = this.botService;

    this.listingsCron.setBroadcaster(this.topicBroadcaster);

    // ── Logging middleware ────────────────────────────────────────────────────
    bot.use((ctx, next) => {
      const type = Object.keys(ctx.update).filter((k) => k !== 'update_id')[0] ?? 'unknown';
      const text = ctx.message?.text ?? ctx.callbackQuery?.data ?? '';
      this.logger.log(`[update] type=${type} "${text.slice(0, 60)}"`);
      return next();
    });

    // ── Group guard: delete messages from non-admins in the super-group ───────
    // Callback queries (e.g. "Men kelaman" button) are never filtered.
    bot.on('message', async (ctx, next) => {
      const groupId = this.config.get<number | null>('bot.groupId', null);
      if (!groupId) return next();
      if (ctx.chat?.id !== groupId) return next();

      const adminIds: number[] = this.config.get<number[]>('bot.adminTelegramIds', []);
      const senderId = ctx.from?.id;
      if (!senderId) return next();
      if (adminIds.includes(senderId)) return next();

      // Non-admin wrote in the group — silently delete
      try {
        await ctx.deleteMessage();
        this.logger.log(`Deleted group message from non-admin ${senderId}`);
      } catch (err: any) {
        this.logger.warn(`Could not delete group message: ${err.message}`);
      }
      // Stop processing — don't run conversations or other handlers
    });

    // ── Register conversations ────────────────────────────────────────────────
    bot.use(
      createConversation(
        createRegisterDriverScene(
          this.driversService,
          this.usersService,
          this.notificationsService,
          this.config,
        ),
        'registerDriver',
      ),
    );

    bot.use(
      createConversation(
        createRequestTaxiScene(
          this.listingsService,
          this.locationsService,
          this.topicBroadcaster,
          this.usersService,
        ),
        'requestTaxi',
      ),
    );

    bot.use(
      createConversation(
        createSetDriverStatusScene(
          this.driversService,
          this.usersService,
          this.locationsService,
        ),
        'setDriverStatus',
      ),
    );

    // ── /start ────────────────────────────────────────────────────────────────
    bot.command('start', async (ctx) => {
      if (ctx.chat?.type !== 'private') return;
      const tgUser = ctx.from;
      if (!tgUser) return;

      try {
        const user = await this.usersService.findOrCreateByTelegramId(BigInt(tgUser.id), {
          firstName: tgUser.first_name,
          lastName: tgUser.last_name,
          username: tgUser.username,
        });

        if (user.isBlocked) {
          await ctx.reply("⛔ Akkauntingiz bloklangan. Admin bilan bog'laning.");
          return;
        }

        await ctx.reply(
          `Assalomu alaykum, <b>${user.firstName}</b>! 👋\n\nYangiobod Taxi botiga xush kelibsiz.\nQuyidagi tugmalardan birini tanlang:`,
          {
            parse_mode: 'HTML',
            reply_markup: buildReplyKeyboard(user, user.driver),
          },
        );
      } catch (err) {
        this.logger.error('/start error', err);
        await ctx.reply("❌ Xatolik yuz berdi. Iltimos qaytadan urinib ko'ring.").catch(() => {});
      }
    });

    // ── /menu — re-show keyboard ──────────────────────────────────────────────
    bot.command('menu', async (ctx) => {
      if (ctx.chat?.type !== 'private') return;
      const tgUser = ctx.from;
      if (!tgUser) return;
      try {
        const user = await this.usersService.findOrCreateByTelegramId(BigInt(tgUser.id), {
          firstName: tgUser.first_name,
        });
        await ctx.reply('Asosiy menyu:', {
          reply_markup: buildReplyKeyboard(user, user.driver),
        });
      } catch (err) {
        this.logger.error('/menu error', err);
      }
    });

    // ── /help ─────────────────────────────────────────────────────────────────
    bot.command('help', async (ctx) => {
      if (ctx.chat?.type !== 'private') return;
      const tgUser = ctx.from;
      if (!tgUser) return;
      try {
        const user = await this.usersService.findOrCreateByTelegramId(BigInt(tgUser.id), {
          firstName: tgUser.first_name,
        });
        const helpText =
          `ℹ️ <b>Yangiobod Taxi Bot — Yordam</b>\n\n` +
          `<b>Mijoz uchun:</b>\n` +
          `🚖 <b>Taksi so'rash</b> — yangi e'lon qo'ying\n` +
          `📊 <b>Bo'sh taxilar</b> — hozirgi bo'sh haydovchilar\n` +
          `📋 <b>Mening e'lonlarim</b> — faol e'lonlaringiz\n\n` +
          `<b>Haydovchi uchun:</b>\n` +
          `🚗 <b>Haydovchi bo'lish</b> — ro'yxatdan o'tish\n` +
          `🚦 <b>Holat o'zgartirish</b> — bo'sh/band holatini yangilash\n\n` +
          `<b>Komandalar:</b>\n` +
          `/start — boshlash / menyuni ko'rsatish\n` +
          `/menu — menyuni qayta ochish\n` +
          `/help — ushbu yordam\n\n` +
          `<b>Qanday ishlaydi?</b>\n` +
          `1️⃣ Mijoz taksi so'raydi\n` +
          `2️⃣ Bot haydovchilar guruhiga e'lon yuboradi\n` +
          `3️⃣ Haydovchi "Men kelaman" bosadi\n` +
          `4️⃣ Ikkalasiga aloqa ma'lumotlari yuboriladi\n\n` +
          `Savollar uchun admin bilan bog'laning.`;

        await ctx.reply(helpText, {
          parse_mode: 'HTML',
          reply_markup: buildReplyKeyboard(user, user.driver),
        });
      } catch (err) {
        this.logger.error('/help error', err);
      }
    });

    // ── Reply keyboard text message handler ───────────────────────────────────
    bot.on('message:text', async (ctx, next) => {
      const text = ctx.message.text;
      const tgUser = ctx.from;

      // /commands are handled separately, skip them here
      if (text.startsWith('/')) return next();

      // Check if this is a known ReplyKeyboard button
      const isDriverStatusBtn = BTN.DRIVER_STATUS.some((b) => text.startsWith(b.slice(0, 10)));
      const isKnownBtn = [
        BTN.REQUEST_TAXI,
        BTN.AVAILABLE_TAXIS,
        BTN.BECOME_DRIVER,
        BTN.MY_LISTINGS,
        BTN.PROFILE,
        BTN.PENDING_INFO,
        BTN.GROUP,
      ].includes(text as any) || isDriverStatusBtn;

      if (!isKnownBtn) return next();

      try {
        const user = await this.usersService.findOrCreateByTelegramId(BigInt(tgUser.id), {
          firstName: tgUser.first_name,
          lastName: tgUser.last_name,
          username: tgUser.username,
        });

        if (user.isBlocked) {
          await ctx.reply("⛔ Akkauntingiz bloklangan. Admin bilan bog'laning.");
          return;
        }

        if (text === BTN.REQUEST_TAXI) {
          await ctx.conversation.enter('requestTaxi');
          return;
        }

        if (text === BTN.AVAILABLE_TAXIS) {
          await this.handleShowAvailableTaxis(ctx, user);
          return;
        }

        if (text === BTN.BECOME_DRIVER) {
          if (user.driver) {
            await ctx.reply("Siz allaqachon haydovchi sifatida ro'yxatdan o'tgansiz.");
            return;
          }
          await ctx.conversation.enter('registerDriver');
          return;
        }

        if (isDriverStatusBtn) {
          if (!user.driver || user.driver.status !== RegistrationStatus.ACTIVE) {
            await ctx.reply("❌ Bu funksiya faqat tasdiqlangan haydovchilar uchun.");
            return;
          }
          await ctx.conversation.enter('setDriverStatus');
          return;
        }

        if (text === BTN.MY_LISTINGS) {
          await this.handleMyListings(ctx, user);
          return;
        }

        if (text === BTN.PROFILE) {
          await this.handleProfile(ctx, user);
          return;
        }

        if (text === BTN.PENDING_INFO) {
          await ctx.reply("⏳ Arizangiz ko'rib chiqilmoqda. Admin tasdiqlagunicha kuting.\n\nSavollar uchun admin: @" +
            (this.config.get<string>('ADMIN_USERNAME', 'admin')));
          return;
        }

        if (text === BTN.GROUP) {
          const groupLink = this.config.get<string>('bot.groupLink', '');
          if (!groupLink) {
            await ctx.reply("Guruh linki hali sozlanmagan. Admin bilan bog'laning.");
            return;
          }
          const kb = new InlineKeyboard().url('📢 Guruhga o\'tish', groupLink);
          await ctx.reply(
            `📢 <b>Yangiobod Taxi guruhi</b>\n\nBu guruhda mijozlarning so'rovlari chiqadi.\nHaydovchilar "🚗 Men kelaman" tugmasini bosib javob berishadi.`,
            { parse_mode: 'HTML', reply_markup: kb },
          );
          return;
        }
      } catch (err) {
        this.logger.error(`message:text handler error: ${err}`);
        await ctx.reply("❌ Xatolik yuz berdi. /start bosib qaytadan urinib ko'ring.").catch(() => {});
      }
    });

    // ── Unknown text / catch-all for non-command messages ─────────────────────
    bot.on('message:text', async (ctx) => {
      const tgUser = ctx.from;
      try {
        const user = await this.usersService.findOrCreateByTelegramId(BigInt(tgUser.id), {
          firstName: tgUser.first_name,
        });
        await ctx.reply(
          "Iltimos, quyidagi tugmalardan foydalaning yoki /start bosing.",
          { reply_markup: buildReplyKeyboard(user, user.driver) },
        );
      } catch {
        await ctx.reply('/start bosing.').catch(() => {});
      }
    });

    // ── Inline callback: request_taxi ─────────────────────────────────────────
    bot.callbackQuery('request_taxi', async (ctx) => {
      try {
        await ctx.answerCallbackQuery();
        await ctx.conversation.enter('requestTaxi');
      } catch (err) {
        this.logger.error('request_taxi cb error', err);
        await ctx.answerCallbackQuery({ text: "Xatolik yuz berdi.", show_alert: true }).catch(() => {});
      }
    });

    // ── Inline callback: show_available_taxis ─────────────────────────────────
    bot.callbackQuery('show_available_taxis', async (ctx) => {
      try {
        await ctx.answerCallbackQuery();
        const tgUser = ctx.from;
        const user = await this.usersService.findOrCreateByTelegramId(BigInt(tgUser.id), {
          firstName: tgUser.first_name,
        });
        await this.handleShowAvailableTaxis(ctx, user);
      } catch (err) {
        this.logger.error('show_available_taxis cb error', err);
        await ctx.answerCallbackQuery({ text: "Xatolik yuz berdi.", show_alert: true }).catch(() => {});
      }
    });

    // ── Inline callback: become_driver ────────────────────────────────────────
    bot.callbackQuery('become_driver', async (ctx) => {
      try {
        await ctx.answerCallbackQuery();
        await ctx.conversation.enter('registerDriver');
      } catch (err) {
        this.logger.error('become_driver cb error', err);
        await ctx.answerCallbackQuery({ text: "Xatolik yuz berdi.", show_alert: true }).catch(() => {});
      }
    });

    // ── Inline callback: toggle_availability ─────────────────────────────────
    bot.callbackQuery('toggle_availability', async (ctx) => {
      try {
        await ctx.answerCallbackQuery();
        await ctx.conversation.enter('setDriverStatus');
      } catch (err) {
        this.logger.error('toggle_availability cb error', err);
        await ctx.answerCallbackQuery({ text: "Xatolik yuz berdi.", show_alert: true }).catch(() => {});
      }
    });

    // ── Inline callback: my_listings ──────────────────────────────────────────
    bot.callbackQuery('my_listings', async (ctx) => {
      try {
        await ctx.answerCallbackQuery();
        const tgUser = ctx.from;
        const user = await this.usersService.findOrCreateByTelegramId(BigInt(tgUser.id), {
          firstName: tgUser.first_name,
        });
        await this.handleMyListings(ctx, user);
      } catch (err) {
        this.logger.error('my_listings cb error', err);
        await ctx.answerCallbackQuery({ text: "Xatolik yuz berdi.", show_alert: true }).catch(() => {});
      }
    });

    // ── Inline callback: close_listing ────────────────────────────────────────
    bot.callbackQuery(/^close_listing:(.+)$/, async (ctx) => {
      try {
        await ctx.answerCallbackQuery();
        const listingId = ctx.match[1];
        const updated = await this.listingsService.closeListing(listingId, 'Client found a ride');
        if (updated.status === ListingStatus.CLOSED) {
          await ctx.editMessageText('✅ E\'lon yopildi. Yaxshi sayohat!').catch(() => {});
          await this.topicBroadcaster.updateBroadcast(listingId, 'CLOSED');
        }
      } catch (err) {
        this.logger.error('close_listing cb error', err);
        await ctx.answerCallbackQuery({ text: "Xatolik. E'lon topilmadi.", show_alert: true }).catch(() => {});
      }
    });

    // ── Inline callback: cancel_listing ──────────────────────────────────────
    bot.callbackQuery(/^cancel_listing:(.+)$/, async (ctx) => {
      try {
        await ctx.answerCallbackQuery();
        const listingId = ctx.match[1];
        const tgUser = ctx.from;
        const user = await this.usersService.findOrCreateByTelegramId(BigInt(tgUser.id), {
          firstName: tgUser.first_name,
        });
        await this.listingsService.cancelListing(listingId, user.id);
        await ctx.editMessageText("🗑 E'lon bekor qilindi.").catch(() => {});
        await this.topicBroadcaster.updateBroadcast(listingId, 'CLOSED');
      } catch (err) {
        this.logger.error('cancel_listing cb error', err);
        await ctx.answerCallbackQuery({ text: "Xatolik. E'lon topilmadi.", show_alert: true }).catch(() => {});
      }
    });

    // ── Inline callback: respond_listing (driver → topic group) ──────────────
    bot.callbackQuery(/^respond_listing:(.+)$/, async (ctx) => {
      const listingId = ctx.match[1];
      const tgUser = ctx.from;

      try {
        const user = await this.usersService.findOrCreateByTelegramId(BigInt(tgUser.id), {
          firstName: tgUser.first_name,
          username: tgUser.username,
        });

        if (!user.driver || user.driver.status !== RegistrationStatus.ACTIVE) {
          await ctx.answerCallbackQuery({
            text: "Faqat tasdiqlangan haydovchilar javob bera oladi.",
            show_alert: true,
          });
          return;
        }

        const listing = await this.listingsService.findById(listingId);
        if (!listing) {
          await ctx.answerCallbackQuery({ text: "E'lon topilmadi.", show_alert: true });
          return;
        }
        if (listing.status !== ListingStatus.ACTIVE) {
          await ctx.answerCallbackQuery({ text: "Bu e'lon allaqachon yopilgan.", show_alert: true });
          return;
        }

        const driver = await this.prisma.driver.findUnique({
          where: { userId: user.id },
          include: { user: true },
        });
        if (!driver) {
          await ctx.answerCallbackQuery({ text: "Haydovchi ma'lumoti topilmadi.", show_alert: true });
          return;
        }

        await this.listingsService.matchWithDriver(listingId, driver.id);

        const client = listing.client;

        // ── Notify client about the driver ──
        const toClientText =
          `🚗 <b>Haydovchi topildi!</b>\n\n` +
          `👤 ${driver.user.firstName}${driver.user.lastName ? ' ' + driver.user.lastName : ''}` +
          `${driver.user.username ? ` (@${driver.user.username})` : ''}\n` +
          `🚙 ${driver.carModel}${driver.carColor ? ' (' + driver.carColor + ')' : ''} — ${driver.carNumber}\n` +
          `📍 ${listing.from.name} → ${listing.to.name}\n\n` +
          (driver.user.phone
            ? `📞 <b>${driver.user.phone}</b> — qo'ng'iroq qiling yoki Telegramda yozing`
            : driver.user.username
              ? `💬 Telegram: @${driver.user.username}`
              : "Haydovchi bilan bog'laning");

        const toClientKb = new InlineKeyboard();
        if (driver.user.phone) {
          toClientKb.url('📞 Qo\'ng\'iroq', `tel:${driver.user.phone}`);
        }
        if (driver.user.username) {
          toClientKb.url('💬 Telegram', `https://t.me/${driver.user.username}`);
        }

        if (toClientKb.inline_keyboard.length > 0) {
          await this.notificationsService.sendToUserWithKeyboard(
            Number(client.telegramId),
            toClientText,
            toClientKb,
          );
        } else {
          await this.notificationsService.sendToUser(Number(client.telegramId), toClientText);
        }

        // ── Notify driver about the client ──
        const toDriverText =
          `✅ <b>Buyurtma qabul qilindi!</b>\n\n` +
          `👤 ${client.firstName}${client.lastName ? ' ' + client.lastName : ''}` +
          `${client.username ? ` (@${client.username})` : ''}\n` +
          `📍 ${listing.from.name} → ${listing.to.name}\n` +
          (listing.passengerCount > 0 ? `👥 ${listing.passengerCount} kishi\n` : '📦 Faqat pochta\n') +
          (listing.priceOffer ? `💰 ${listing.priceOffer.toLocaleString()} so'm\n` : '') +
          '\n' +
          (client.phone
            ? `📞 <b>${client.phone}</b> — qo'ng'iroq qiling`
            : client.username
              ? `💬 Telegram: @${client.username}`
              : "Mijoz bilan bog'laning");

        const toDriverKb = new InlineKeyboard();
        if (client.phone) {
          toDriverKb.url('📞 Qo\'ng\'iroq', `tel:${client.phone}`);
        }
        if (client.username) {
          toDriverKb.url('💬 Telegram', `https://t.me/${client.username}`);
        }

        if (toDriverKb.inline_keyboard.length > 0) {
          await this.notificationsService.sendToUserWithKeyboard(
            Number(driver.user.telegramId),
            toDriverText,
            toDriverKb,
          );
        } else {
          await this.notificationsService.sendToUser(Number(driver.user.telegramId), toDriverText);
        }

        await this.topicBroadcaster.updateBroadcast(listingId, 'MATCHED');
        await ctx.answerCallbackQuery({
          text: "✅ Mijoz bilan aloqa ma'lumotlari DM ga yuborildi.",
          show_alert: true,
        });
      } catch (err) {
        this.logger.error('respond_listing cb error', err);
        await ctx.answerCallbackQuery({ text: "Xatolik yuz berdi.", show_alert: true }).catch(() => {});
      }
    });

    // ── Inline callback: back_to_menu ─────────────────────────────────────────
    bot.callbackQuery('back_to_menu', async (ctx) => {
      try {
        await ctx.answerCallbackQuery();
        const tgUser = ctx.from;
        const user = await this.usersService.findOrCreateByTelegramId(BigInt(tgUser.id), {
          firstName: tgUser.first_name,
        });
        await ctx.reply('Asosiy menyu:', {
          reply_markup: buildReplyKeyboard(user, user.driver),
        });
      } catch (err) {
        this.logger.error('back_to_menu cb error', err);
      }
    });

    // ── Global cancel ─────────────────────────────────────────────────────────
    bot.callbackQuery('cancel', async (ctx) => {
      try {
        await ctx.answerCallbackQuery({ text: 'Bekor qilindi' });
        await ctx.conversation.exit();
        const tgUser = ctx.from;
        const user = await this.usersService.findOrCreateByTelegramId(BigInt(tgUser.id), {
          firstName: tgUser.first_name,
        });
        await ctx.reply('Bekor qilindi. Asosiy menyu:', {
          reply_markup: buildReplyKeyboard(user, user.driver),
        });
      } catch (err) {
        this.logger.error('cancel cb error', err);
      }
    });

    // ── Inline callback: profile ──────────────────────────────────────────────
    bot.callbackQuery('profile', async (ctx) => {
      try {
        await ctx.answerCallbackQuery();
        const tgUser = ctx.from;
        const user = await this.usersService.findOrCreateByTelegramId(BigInt(tgUser.id), {
          firstName: tgUser.first_name,
          lastName: tgUser.last_name,
          username: tgUser.username,
        });
        await this.handleProfile(ctx, user);
      } catch (err) {
        this.logger.error('profile cb error', err);
      }
    });

    // ── Admin: /block <driverId> command ──────────────────────────────────────
    bot.command('block', async (ctx) => {
      if (ctx.chat?.type !== 'private') return;
      const adminIds: number[] = this.config.get<number[]>('bot.adminTelegramIds', []);
      if (!ctx.from || !adminIds.includes(ctx.from.id)) return;

      const driverId = ctx.match?.trim();
      if (!driverId) {
        await ctx.reply('Ishlatish: /block <driver_id>');
        return;
      }
      try {
        const driver = await this.prisma.driver.findUnique({
          where: { id: driverId },
          include: { user: true },
        });
        if (!driver) { await ctx.reply('Haydovchi topilmadi.'); return; }

        await this.driversService.setStatus(driverId, RegistrationStatus.BLOCKED);
        await this.notificationsService.sendToUser(
          Number(driver.user.telegramId),
          "🚫 Akkauntingiz bloklandi. Batafsil ma'lumot uchun admin bilan bog'laning.",
        );
        await ctx.reply(
          `✅ ${driver.user.firstName} (${driver.carNumber}) bloklandi.`,
        );
      } catch (err) {
        this.logger.error('/block error', err);
        await ctx.reply('Xatolik yuz berdi.').catch(() => {});
      }
    });

    // ── Admin: /unblock <driverId> command ────────────────────────────────────
    bot.command('unblock', async (ctx) => {
      if (ctx.chat?.type !== 'private') return;
      const adminIds: number[] = this.config.get<number[]>('bot.adminTelegramIds', []);
      if (!ctx.from || !adminIds.includes(ctx.from.id)) return;

      const driverId = ctx.match?.trim();
      if (!driverId) {
        await ctx.reply('Ishlatish: /unblock <driver_id>');
        return;
      }
      try {
        const driver = await this.prisma.driver.findUnique({
          where: { id: driverId },
          include: { user: true },
        });
        if (!driver) { await ctx.reply('Haydovchi topilmadi.'); return; }

        await this.driversService.setStatus(driverId, RegistrationStatus.ACTIVE);
        await this.notificationsService.sendToUser(
          Number(driver.user.telegramId),
          "✅ Akkauntingiz tiklandi! Endi yana ishlashingiz mumkin. /start bosing.",
        );
        await ctx.reply(`✅ ${driver.user.firstName} (${driver.carNumber}) tiklandi.`);
      } catch (err) {
        this.logger.error('/unblock error', err);
        await ctx.reply('Xatolik yuz berdi.').catch(() => {});
      }
    });

    // ── Admin inline: block_driver button (from registration notification) ────
    bot.callbackQuery(/^admin:block_driver:(.+)$/, async (ctx) => {
      try {
        const adminIds: number[] = this.config.get<number[]>('bot.adminTelegramIds', []);
        if (!adminIds.includes(ctx.from.id)) {
          await ctx.answerCallbackQuery({ text: "Ruxsat yo'q.", show_alert: true });
          return;
        }
        const driverId = ctx.match[1];
        const driver = await this.prisma.driver.findUnique({
          where: { id: driverId },
          include: { user: true },
        });
        if (!driver) {
          await ctx.answerCallbackQuery({ text: 'Haydovchi topilmadi.', show_alert: true });
          return;
        }
        await this.driversService.setStatus(driverId, RegistrationStatus.BLOCKED);
        await this.prisma.user.update({
          where: { id: driver.userId },
          data: { role: UserRole.CLIENT },
        });
        const orig = ctx.callbackQuery.message?.text ?? '';
        await ctx.editMessageText(orig + '\n\n🚫 <b>BLOKLANDI</b>', { parse_mode: 'HTML' }).catch(() => {});
        await this.notificationsService.sendToUser(
          Number(driver.user.telegramId),
          "🚫 Akkauntingiz bloklandi. Admin bilan bog'laning.",
        );
        await ctx.answerCallbackQuery({ text: 'Bloklandi.' });
      } catch (err) {
        this.logger.error('block_driver cb error', err);
        await ctx.answerCallbackQuery({ text: "Xatolik yuz berdi.", show_alert: true }).catch(() => {});
      }
    });

    // ── Info popups ───────────────────────────────────────────────────────────
    bot.callbackQuery('show_pending_info', async (ctx) => {
      await ctx.answerCallbackQuery({
        text: "Arizangiz ko'rib chiqilmoqda. Iltimos kuting.",
        show_alert: true,
      }).catch(() => {});
    });

    bot.callbackQuery('show_blocked_info', async (ctx) => {
      await ctx.answerCallbackQuery({
        text: "Akkauntingiz bloklangan. Admin bilan bog'laning.",
        show_alert: true,
      }).catch(() => {});
    });

    // ── Catch-all callbacks (must stay last) ──────────────────────────────────
    bot.callbackQuery(/^.+$/, async (ctx) => {
      await ctx.answerCallbackQuery().catch(() => {});
    });

    void bot.start({
      onStart: (info) => this.logger.log(`Bot is running as @${info.username}`),
    });
    this.logger.log('Bot is running');
  }

  // ── Shared handler logic ──────────────────────────────────────────────────

  private async handleShowAvailableTaxis(ctx: any, user: any): Promise<void> {
    const counts = await this.driversService.getAvailableCountsByLocation();

    if (counts.length === 0) {
      await ctx.reply(
        "📊 <b>Hozirgi bo'sh taxilar</b>\n\nHozircha bo'sh haydovchi yo'q.",
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text("🚖 Taksi so'rash", 'request_taxi'),
        },
      );
      return;
    }

    const lines = ["📊 <b>Hozirgi bo'sh taxilar:</b>", ''];
    for (const entry of counts) {
      lines.push(`📍 <b>${entry.locationName}</b>: ${entry.driverCount} haydovchi, ${entry.totalSeats} joy`);
    }
    lines.push('');
    lines.push("<i>Taksi so'rash uchun tugmani bosing</i>");

    await ctx.reply(lines.join('\n'), {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text("🚖 Taksi so'rash", 'request_taxi'),
    });
  }

  private async handleMyListings(ctx: any, user: any): Promise<void> {
    const listings = await this.listingsService.getClientActiveListings(user.id);

    if (listings.length === 0) {
      await ctx.reply("📋 Hozircha faol e'lonlaringiz yo'q.", {
        reply_markup: new InlineKeyboard().text("🚖 Yangi e'lon", 'request_taxi'),
      });
      return;
    }

    await ctx.reply(`📋 <b>Faol e'lonlaringiz (${listings.length} ta):</b>`, { parse_mode: 'HTML' });

    for (const listing of listings) {
      const passText = listing.parcelOnly ? 'Faqat pochta' : `${listing.passengerCount} kishi`;
      const timeText = formatNeedTime(listing.needTime as NeedTime, listing.scheduledAt);
      const priceText = listing.priceOffer
        ? `${listing.priceOffer.toLocaleString()} so'm`
        : 'Kelishiladi';

      const cardText =
        `📍 <b>${listing.from.name} → ${listing.to.name}</b>\n` +
        `👥 ${passText}  ⏰ ${timeText}  💰 ${priceText}\n` +
        `🔔 Holat: <b>Kutilmoqda</b>`;

      const cardKb = new InlineKeyboard()
        .text('✅ Topdim', `close_listing:${listing.id}`)
        .text('❌ Bekor', `cancel_listing:${listing.id}`);

      await ctx.reply(cardText, { parse_mode: 'HTML', reply_markup: cardKb });
    }
  }

  private async handleProfile(ctx: any, user: any): Promise<void> {
    const driver = user.driver;
    let text =
      `👤 <b>Profil</b>\n\n` +
      `Ism: <b>${user.firstName}${user.lastName ? ' ' + user.lastName : ''}</b>\n`;

    if (user.username) text += `Username: @${user.username}\n`;
    if (user.phone) text += `Telefon: ${user.phone}\n`;

    if (driver) {
      const regLabel =
        driver.status === RegistrationStatus.ACTIVE
          ? '✅ Faol'
          : driver.status === RegistrationStatus.PENDING
            ? '⏳ Kutilmoqda'
            : '❌ Bloklangan';

      text +=
        `\n🚗 <b>Haydovchi ma'lumotlari:</b>\n` +
        `Model: <b>${driver.carModel}</b>\n` +
        `Raqam: <b>${driver.carNumber}</b>\n` +
        (driver.carColor ? `Rang: <b>${driver.carColor}</b>\n` : '') +
        `Ro'yxat holati: ${regLabel}`;
    }

    await ctx.reply(text, { parse_mode: 'HTML' });
  }
}

