import { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import { LocationTier, NeedTime } from '@prisma/client';
import { BotContext } from '../bot.context';
import { ListingsService } from '../../listings/listings.service';
import { LocationsService } from '../../locations/locations.service';
import { TopicBroadcasterService } from '../../notifications/topic-broadcaster.service';
import { UsersService } from '../../users/users.service';
import { buildLocationsKeyboard } from '../keyboards/locations.keyboard';
import { formatNeedTime } from '../../notifications/topic-broadcaster.service';

export function createRequestTaxiScene(
  listingsService: ListingsService,
  locationsService: LocationsService,
  topicBroadcaster: TopicBroadcasterService,
  usersService: UsersService,
) {
  return async function requestTaxi(
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

    // Anti-spam guard
    const spamCheck = await conversation.external(() =>
      listingsService.canClientCreateListing(user.id),
    );
    if (!spamCheck.allowed) {
      await ctx.reply(
        `⏳ Iltimos ${spamCheck.waitMinutes} daqiqa kuting.\nYangi e'lon qoldirish uchun oz vaqt o'tishi kerak.`,
      );
      return;
    }

    // Fetch CITY + CENTER locations only for cleaner UI
    const allLocations = await conversation.external(() => locationsService.findAll());
    const locations = allLocations.filter(
      (l) => l.tier === LocationTier.CITY || l.tier === LocationTier.CENTER,
    );

    if (locations.length < 2) {
      await ctx.reply("❌ Manzillar hali sozlanmagan. Admin bilan bog'laning.");
      return;
    }

    // ── Step 1: From location ────────────────────────────────────────────────
    const fromKb = buildLocationsKeyboard(locations, 'req_from')
      .row()
      .text('❌ Bekor qilish', 'req_cancel');

    await ctx.reply(
      '🚖 <b>Taksi so\'rash</b>\n\nQayerdan ketasiz?\n<i>Qishloqdanmi? Eng yaqin shaharni tanlang.</i>',
      { parse_mode: 'HTML', reply_markup: fromKb },
    );

    const fromCtx = await conversation.waitForCallbackQuery(/^req_from:.+$|^req_cancel$/);
    await fromCtx.answerCallbackQuery();

    if (fromCtx.callbackQuery.data === 'req_cancel') {
      await fromCtx.editMessageText('❌ Bekor qilindi.');
      return;
    }

    const fromId = fromCtx.callbackQuery.data.split(':')[1];
    const fromLoc = locations.find((l) => l.id === fromId)!;
    await fromCtx.editMessageText(`✅ Qayerdan: <b>${fromLoc.name}</b>`, { parse_mode: 'HTML' });

    // ── Step 2: To location ──────────────────────────────────────────────────
    await ctx.reply('Qayerga borasiz?', { reply_markup: toQb(locations, fromId) });

    const toCtx = await conversation.waitForCallbackQuery(/^req_to:.+$|^req_cancel$/);
    await toCtx.answerCallbackQuery();

    if (toCtx.callbackQuery.data === 'req_cancel') {
      await toCtx.editMessageText('❌ Bekor qilindi.');
      return;
    }

    const toId = toCtx.callbackQuery.data.split(':')[1];
    const toLoc = locations.find((l) => l.id === toId)!;
    await toCtx.editMessageText(`✅ Qayerga: <b>${toLoc.name}</b>`, { parse_mode: 'HTML' });

    // ── Step 3: Passenger count ──────────────────────────────────────────────
    const passKb = new InlineKeyboard()
      .text('1 kishi', 'req_pass:1')
      .text('2 kishi', 'req_pass:2')
      .row()
      .text('3 kishi', 'req_pass:3')
      .text('4 kishi', 'req_pass:4')
      .row()
      .text('📦 Faqat pochta', 'req_pass:parcel')
      .row()
      .text('❌ Bekor qilish', 'req_cancel');

    await ctx.reply('Necha kishi ketasiz?', { reply_markup: passKb });

    const passCtx = await conversation.waitForCallbackQuery(
      /^req_pass:(1|2|3|4|parcel)$|^req_cancel$/,
    );
    await passCtx.answerCallbackQuery();

    if (passCtx.callbackQuery.data === 'req_cancel') {
      await passCtx.editMessageText('❌ Bekor qilindi.');
      return;
    }

    const passVal = passCtx.callbackQuery.data.split(':')[1];
    const parcelOnly = passVal === 'parcel';
    const passengerCount = parcelOnly ? 0 : parseInt(passVal);
    await passCtx.editMessageText(
      parcelOnly ? '✅ Faqat pochta.' : `✅ ${passengerCount} kishi.`,
    );

    // ── Step 4: Parcel? (skip if parcel-only) ───────────────────────────────
    let acceptsParcel = false;
    if (!parcelOnly) {
      const parcelKb = new InlineKeyboard()
        .text('📦 Bor', 'req_parcel:yes')
        .text('📦 Yo\'q', 'req_parcel:no')
        .row()
        .text('❌ Bekor qilish', 'req_cancel');

      await ctx.reply('Pochta ham bormi?', { reply_markup: parcelKb });

      const parcelCtx = await conversation.waitForCallbackQuery(/^req_parcel:(yes|no)$|^req_cancel$/);
      await parcelCtx.answerCallbackQuery();

      if (parcelCtx.callbackQuery.data === 'req_cancel') {
        await parcelCtx.editMessageText('❌ Bekor qilindi.');
        return;
      }

      acceptsParcel = parcelCtx.callbackQuery.data === 'req_parcel:yes';
      await parcelCtx.editMessageText(acceptsParcel ? '✅ Pochta bor.' : '✅ Pochta yo\'q.');
    }

    // ── Step 5: When? ────────────────────────────────────────────────────────
    const whenKb = new InlineKeyboard()
      .text('Hozir', 'req_when:NOW')
      .text('15 daq', 'req_when:IN_15_MIN')
      .row()
      .text('30 daq', 'req_when:IN_30_MIN')
      .text('1 soat', 'req_when:IN_1_HOUR')
      .row()
      .text('⏰ Aniq vaqt', 'req_when:SCHEDULED')
      .row()
      .text('❌ Bekor qilish', 'req_cancel');

    await ctx.reply('Qachon kerak?', { reply_markup: whenKb });

    const whenCtx = await conversation.waitForCallbackQuery(
      /^req_when:(NOW|IN_15_MIN|IN_30_MIN|IN_1_HOUR|SCHEDULED)$|^req_cancel$/,
    );
    await whenCtx.answerCallbackQuery();

    if (whenCtx.callbackQuery.data === 'req_cancel') {
      await whenCtx.editMessageText('❌ Bekor qilindi.');
      return;
    }

    const whenVal = whenCtx.callbackQuery.data.split(':')[1] as keyof typeof NeedTime;
    const needTime = NeedTime[whenVal];
    let scheduledAt: Date | undefined;

    if (needTime === NeedTime.SCHEDULED) {
      await whenCtx.editMessageText('⏰ Aniq vaqt tanlandi.');
      await ctx.reply('Soatni kiriting (HH:MM, masalan: 14:30):');

      let parsed: Date | null = null;
      while (!parsed) {
        const txtCtx = await conversation.waitFor(':text');
        const input = txtCtx.message!.text.trim();
        if (/^([01]\d|2[0-3]):[0-5]\d$/.test(input)) {
          parsed = parseExactTime(input);
          await txtCtx.react('👍').catch(() => {});
        } else {
          await ctx.reply("❌ Noto'g'ri format. HH:MM kiriting (masalan: 14:30):");
        }
      }
      scheduledAt = parsed;
    } else {
      await whenCtx.editMessageText(`✅ Vaqt: <b>${formatNeedTime(needTime)}</b>`, {
        parse_mode: 'HTML',
      });
    }

    // ── Step 6: Price (optional) ─────────────────────────────────────────────
    const priceKb = new InlineKeyboard()
      .text('Kelishiladi', 'req_price:skip')
      .text('10 000', 'req_price:10000')
      .row()
      .text('20 000', 'req_price:20000')
      .text('30 000', 'req_price:30000')
      .row()
      .text('50 000', 'req_price:50000')
      .text('✏️ Boshqa narx', 'req_price:custom')
      .row()
      .text('❌ Bekor qilish', 'req_cancel');

    await ctx.reply('💰 Narx aytasizmi?', { reply_markup: priceKb });

    const priceCtx = await conversation.waitForCallbackQuery(
      /^req_price:(skip|\d+|custom)$|^req_cancel$/,
    );
    await priceCtx.answerCallbackQuery();

    if (priceCtx.callbackQuery.data === 'req_cancel') {
      await priceCtx.editMessageText('❌ Bekor qilindi.');
      return;
    }

    let priceOffer: number | undefined;
    const priceVal = priceCtx.callbackQuery.data.split(':')[1];

    if (priceVal === 'custom') {
      await priceCtx.editMessageText('Narxni kiriting (faqat raqam):');
      let priceInput: number | null = null;
      while (priceInput === null) {
        const pCtx = await conversation.waitFor(':text');
        const num = parseInt(pCtx.message!.text.replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > 0) {
          priceInput = num;
          await pCtx.react('👍').catch(() => {});
        } else {
          await ctx.reply('❌ Faqat musbat raqam kiriting:');
        }
      }
      priceOffer = priceInput;
    } else if (priceVal !== 'skip') {
      priceOffer = parseInt(priceVal, 10);
    }

    const priceDisplay = priceOffer ? `${priceOffer.toLocaleString()} so'm` : 'Kelishiladi';
    if (priceVal !== 'custom') {
      await priceCtx.editMessageText(`✅ Narx: <b>${priceDisplay}</b>`, { parse_mode: 'HTML' });
    }

    // ── Step 7: Comment (optional) ───────────────────────────────────────────
    const commentKb = new InlineKeyboard()
      .text('✅ Tayyor, e\'lon qo\'sh', 'req_comment:skip')
      .row()
      .text('✏️ Izoh yozaman', 'req_comment:write')
      .row()
      .text('❌ Bekor qilish', 'req_cancel');

    await ctx.reply('Qo\'shimcha izoh yozasizmi?', { reply_markup: commentKb });

    const commentChoiceCtx = await conversation.waitForCallbackQuery(
      /^req_comment:(skip|write)$|^req_cancel$/,
    );
    await commentChoiceCtx.answerCallbackQuery();

    if (commentChoiceCtx.callbackQuery.data === 'req_cancel') {
      await commentChoiceCtx.editMessageText('❌ Bekor qilindi.');
      return;
    }

    let comment: string | undefined;
    if (commentChoiceCtx.callbackQuery.data === 'req_comment:write') {
      await commentChoiceCtx.editMessageText('Izohingizni yozing (maksimal 200 ta belgi):');
      const cCtx = await conversation.waitFor(':text');
      comment = cCtx.message!.text.trim().slice(0, 200);
      await cCtx.react('👍').catch(() => {});
    }

    // ── Step 8: Confirm ──────────────────────────────────────────────────────
    const summary = buildSummary({
      fromName: fromLoc.name,
      toName: toLoc.name,
      passengerCount,
      parcelOnly,
      acceptsParcel,
      needTime,
      scheduledAt,
      priceDisplay,
      comment,
    });

    const confirmKb = new InlineKeyboard()
      .text("✅ E'lon qo'sh", 'req_confirm')
      .row()
      .text("✏️ Qaytadan boshlash", 'req_restart')
      .row()
      .text('❌ Bekor qilish', 'req_cancel');

    await ctx.reply(summary, { parse_mode: 'HTML', reply_markup: confirmKb });

    const confirmCtx = await conversation.waitForCallbackQuery(
      /^req_confirm$|^req_restart$|^req_cancel$/,
    );
    await confirmCtx.answerCallbackQuery();

    if (confirmCtx.callbackQuery.data === 'req_cancel') {
      await confirmCtx.editMessageText('❌ Bekor qilindi.');
      return;
    }

    if (confirmCtx.callbackQuery.data === 'req_restart') {
      await confirmCtx.editMessageText('🔄 Qaytadan boshlash...');
      await ctx.conversation.exit();
      await ctx.conversation.enter('requestTaxi');
      return;
    }

    // ── Create listing + broadcast ───────────────────────────────────────────
    await confirmCtx.editMessageText('⏳ E\'lon joylashtirilmoqda...');

    const listing = await conversation.external(() =>
      listingsService.createListing({
        clientId: user.id,
        fromId,
        toId,
        passengerCount,
        acceptsParcel: parcelOnly ? true : acceptsParcel,
        parcelOnly,
        needTime,
        scheduledAt,
        priceOffer,
        comment,
      }),
    );

    const broadcast = await conversation.external(() =>
      topicBroadcaster.broadcastListing(listing.id),
    );

    const destinationName = toLoc.name;
    const broadcastNote = broadcast.success
      ? `📢 E'loningiz <b>${destinationName}</b> guruhiga yuborildi.`
      : `⚠️ Guruhga yuborishda xatolik (topic sozlanmagan bo'lishi mumkin), lekin e'lon saqlandi.`;

    await ctx.reply(
      `✅ <b>E'lon joylashtirildi!</b>\n\n` +
      `📍 ${fromLoc.name} → ${toLoc.name}\n\n` +
      broadcastNote +
      `\n\nHaydovchi javob bersa, sizga xabar beramiz.`,
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text("📋 Mening e'lonlarim", 'my_listings'),
      },
    );
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toQb(locations: import('@prisma/client').Location[], exclude: string): InlineKeyboard {
  return buildLocationsKeyboard(locations, 'req_to', exclude)
    .row()
    .text('❌ Bekor qilish', 'req_cancel');
}

function buildSummary(data: {
  fromName: string;
  toName: string;
  passengerCount: number;
  parcelOnly: boolean;
  acceptsParcel: boolean;
  needTime: NeedTime;
  scheduledAt?: Date;
  priceDisplay: string;
  comment?: string;
}): string {
  const lines = [
    `📋 <b>E'lonni tekshiring:</b>`,
    '',
    `📍 <b>${data.fromName} → ${data.toName}</b>`,
  ];

  if (data.parcelOnly) {
    lines.push('👥 Faqat pochta');
  } else {
    lines.push(`👥 ${data.passengerCount} kishi`);
    if (data.acceptsParcel) lines.push('📦 Pochta ham bor');
  }

  lines.push(`⏰ ${formatNeedTime(data.needTime, data.scheduledAt)}`);
  lines.push(`💰 ${data.priceDisplay}`);

  if (data.comment) lines.push(`💬 ${data.comment}`);

  return lines.join('\n');
}

function parseExactTime(input: string): Date {
  const [hour, minute] = input.split(':').map(Number);
  const date = new Date();
  date.setSeconds(0, 0);
  date.setHours(hour, minute);
  if (date <= new Date()) date.setDate(date.getDate() + 1);
  return date;
}
