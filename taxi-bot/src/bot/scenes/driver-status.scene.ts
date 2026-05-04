import { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import { DriverStatus, LocationTier } from '@prisma/client';
import { BotContext } from '../bot.context';
import { DriversService } from '../../drivers/drivers.service';
import { UsersService } from '../../users/users.service';
import { LocationsService } from '../../locations/locations.service';
import { buildLocationsKeyboard } from '../keyboards/locations.keyboard';

export function createSetDriverStatusScene(
  driversService: DriversService,
  usersService: UsersService,
  locationsService: LocationsService,
) {
  return async function setDriverStatus(
    conversation: Conversation<BotContext>,
    ctx: BotContext,
  ) {
    const tgUser = ctx.from!;

    const user = await conversation.external(() =>
      usersService.findOrCreateByTelegramId(BigInt(tgUser.id), {
        firstName: tgUser.first_name,
        lastName: tgUser.last_name,
        username: tgUser.username,
      }),
    );

    if (!user.driver) {
      await ctx.reply("❌ Siz haydovchi emassiz.");
      return;
    }

    const driver = user.driver;

    // ── Step 1: Choose status ────────────────────────────────────────────────
    const statusKb = new InlineKeyboard()
      .text('🟢 Bo\'shman', 'ds_status:AVAILABLE')
      .text('☕ Tanaffus', 'ds_status:BREAK')
      .row()
      .text('🚗 Yo\'ldaman', 'ds_status:ON_TRIP')
      .text('🔴 Yopiq', 'ds_status:OFFLINE')
      .row()
      .text('❌ Bekor qilish', 'ds_cancel');

    await ctx.reply('Holatingizni tanlang:', { reply_markup: statusKb });

    const statusCtx = await conversation.waitForCallbackQuery(
      /^ds_status:(AVAILABLE|BREAK|ON_TRIP|OFFLINE)$|^ds_cancel$/,
    );
    await statusCtx.answerCallbackQuery();

    if (statusCtx.callbackQuery.data === 'ds_cancel') {
      await statusCtx.editMessageText('❌ Bekor qilindi.');
      return;
    }

    const statusKey = statusCtx.callbackQuery.data.split(':')[1] as keyof typeof DriverStatus;
    const newStatus = DriverStatus[statusKey];

    // Non-AVAILABLE statuses: just save and exit
    if (newStatus !== DriverStatus.AVAILABLE) {
      const statusLabel =
        newStatus === DriverStatus.OFFLINE
          ? '🔴 Yopiq'
          : newStatus === DriverStatus.ON_TRIP
            ? '🚗 Yo\'ldaman'
            : '☕ Tanaffus';

      await statusCtx.editMessageText(`✅ Holat: <b>${statusLabel}</b>`, { parse_mode: 'HTML' });

      await conversation.external(() =>
        driversService.updateAvailability(driver.id, {
          currentStatus: newStatus,
          currentLocationId: null,
          availableSeats: 0,
          acceptsParcel: false,
        }),
      );

      await ctx.reply(
        `${statusLabel} — holat yangilandi.`,
        {
          reply_markup: new InlineKeyboard().text('« Asosiy menyu', 'back_to_menu'),
        },
      );
      return;
    }

    await statusCtx.editMessageText('✅ Bo\'shman — aniqroq ma\'lumot kiriting.');

    // ── Step 2: Current location ─────────────────────────────────────────────
    const allLocations = await conversation.external(() => locationsService.findAll());
    const cityLocations = allLocations.filter(
      (l) => l.tier === LocationTier.CITY || l.tier === LocationTier.CENTER,
    );

    const locKb = buildLocationsKeyboard(cityLocations, 'ds_loc')
      .row()
      .text('❌ Bekor qilish', 'ds_cancel');

    await ctx.reply('Hozir qayerdasiz?', { reply_markup: locKb });

    const locCtx = await conversation.waitForCallbackQuery(/^ds_loc:.+$|^ds_cancel$/);
    await locCtx.answerCallbackQuery();

    if (locCtx.callbackQuery.data === 'ds_cancel') {
      await locCtx.editMessageText('❌ Bekor qilindi.');
      return;
    }

    const locationId = locCtx.callbackQuery.data.split(':')[1];
    const location = cityLocations.find((l) => l.id === locationId)!;
    await locCtx.editMessageText(`✅ Joylashuv: <b>${location.name}</b>`, { parse_mode: 'HTML' });

    // ── Step 3: Available seats ──────────────────────────────────────────────
    const seatsKb = new InlineKeyboard()
      .text('1 joy', 'ds_seats:1')
      .text('2 joy', 'ds_seats:2')
      .row()
      .text('3 joy', 'ds_seats:3')
      .text('4 joy', 'ds_seats:4')
      .row()
      .text('❌ Bekor qilish', 'ds_cancel');

    await ctx.reply('Nechta bo\'sh joy bor?', { reply_markup: seatsKb });

    const seatsCtx = await conversation.waitForCallbackQuery(/^ds_seats:\d+$|^ds_cancel$/);
    await seatsCtx.answerCallbackQuery();

    if (seatsCtx.callbackQuery.data === 'ds_cancel') {
      await seatsCtx.editMessageText('❌ Bekor qilindi.');
      return;
    }

    const availableSeats = parseInt(seatsCtx.callbackQuery.data.split(':')[1]);
    await seatsCtx.editMessageText(`✅ Bo'sh joylar: <b>${availableSeats}</b>`, {
      parse_mode: 'HTML',
    });

    // ── Step 4: Accept parcel? ───────────────────────────────────────────────
    const parcelKb = new InlineKeyboard()
      .text('📦 Ha, olaman', 'ds_parcel:yes')
      .text("📦 Yo'q", 'ds_parcel:no');

    await ctx.reply('Pochta qabul qilasizmi?', { reply_markup: parcelKb });

    const parcelCtx = await conversation.waitForCallbackQuery(/^ds_parcel:(yes|no)$/);
    await parcelCtx.answerCallbackQuery();

    const acceptsParcel = parcelCtx.callbackQuery.data === 'ds_parcel:yes';
    await parcelCtx.editMessageText(acceptsParcel ? '✅ Pochta qabul qiladi.' : '✅ Pochta qabul qilmaydi.');

    // ── Save ─────────────────────────────────────────────────────────────────
    await conversation.external(() =>
      driversService.updateAvailability(driver.id, {
        currentStatus: DriverStatus.AVAILABLE,
        currentLocationId: locationId,
        availableSeats,
        acceptsParcel,
      }),
    );

    await ctx.reply(
      `🟢 <b>Siz bo'sh sifatida belgilandi!</b>\n\n` +
      `📍 ${location.name}\n` +
      `💺 ${availableSeats} joy\n` +
      `📦 Pochta: ${acceptsParcel ? 'Ha' : "Yo'q"}`,
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('« Asosiy menyu', 'back_to_menu'),
      },
    );
  };
}
