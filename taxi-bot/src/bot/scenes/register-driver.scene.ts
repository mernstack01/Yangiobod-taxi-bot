import { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard, Keyboard } from 'grammy';
import { ConfigService } from '@nestjs/config';
import { BotContext } from '../bot.context';
import { DriversService } from '../../drivers/drivers.service';
import { UsersService } from '../../users/users.service';
import { NotificationsService } from '../../notifications/notifications.service';

const CAR_MODELS = [
  'Cobalt', 'Nexia', 'Lacetti', 'Gentra',
  'Damas', 'Labo', 'Spark', 'Matiz',
  'Malibu', 'Onix',
];

const CAR_COLORS = [
  'Oq', 'Qora', 'Kulrang', 'Kumush',
  'Moviy', 'Qizil', 'Yashil', 'Sariq',
];

export function createRegisterDriverScene(
  driversService: DriversService,
  usersService: UsersService,
  notificationsService: NotificationsService,
  config: ConfigService,
) {
  return async function registerDriver(
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

    if (user.driver) {
      await ctx.reply("Siz allaqachon haydovchi sifatida ro'yxatdan o'tgansiz.");
      return;
    }

    // ── Step 1: Car model ────────────────────────────────────────────────────
    const carModelKb = new InlineKeyboard();
    CAR_MODELS.forEach((model, i) => {
      carModelKb.text(model, `car_model:${model}`);
      if ((i + 1) % 2 === 0) carModelKb.row();
    });
    carModelKb.row().text('➕ Boshqa', 'car_model:Other');

    await ctx.reply(
      "🚗 <b>Haydovchi ro'yxatdan o'tish</b>\n\nMashina rusumini tanlang:",
      { parse_mode: 'HTML', reply_markup: carModelKb },
    );

    const carModelCbCtx = await conversation.waitForCallbackQuery(/^car_model:.+$/);
    await carModelCbCtx.answerCallbackQuery();
    const carModelRaw = carModelCbCtx.callbackQuery.data.split(':')[1];

    let carModel: string;
    if (carModelRaw === 'Other') {
      await carModelCbCtx.editMessageText('Mashina rusumini yozing (3–20 belgi):');
      carModel = await askFreeText(conversation, ctx, 3, 20);
      if (!carModel) return;
    } else {
      carModel = carModelRaw;
      await carModelCbCtx.editMessageText(`✅ Mashina: <b>${carModel}</b>`, { parse_mode: 'HTML' });
    }

    // ── Step 2: Car number ───────────────────────────────────────────────────
    await ctx.reply(
      'Mashina raqamini kiriting:\n<i>Masalan: 01A 123 BB</i>',
      { parse_mode: 'HTML' },
    );

    const carNumberCtx = await conversation.waitFor(':text');
    const carNumber = carNumberCtx.message!.text.trim().toUpperCase();

    // ── Step 3: Car color ────────────────────────────────────────────────────
    const colorKb = new InlineKeyboard();
    CAR_COLORS.forEach((color, i) => {
      colorKb.text(color, `car_color:${color}`);
      if ((i + 1) % 2 === 0) colorKb.row();
    });
    colorKb.row()
      .text('➕ Boshqa', 'car_color:Other')
      .text("⏭ O'tkazib yuborish", 'car_color:skip');

    await ctx.reply('Mashina rangini tanlang (ixtiyoriy):', { reply_markup: colorKb });

    const colorCbCtx = await conversation.waitForCallbackQuery(/^car_color:.+$/);
    await colorCbCtx.answerCallbackQuery();
    const colorRaw = colorCbCtx.callbackQuery.data.split(':')[1];

    let carColor: string | undefined;
    if (colorRaw === 'skip') {
      await colorCbCtx.editMessageText("⏭ Rang ko'rsatilmagan.");
    } else if (colorRaw === 'Other') {
      await colorCbCtx.editMessageText('Mashina rangini yozing:');
      const custom = await askFreeText(conversation, ctx, 2, 20);
      if (custom) carColor = custom;
    } else {
      carColor = colorRaw;
      await colorCbCtx.editMessageText(`✅ Rang: <b>${carColor}</b>`, { parse_mode: 'HTML' });
    }

    // ── Step 4: Phone number ─────────────────────────────────────────────────
    const phoneShareKb = new Keyboard()
      .requestContact('📱 Raqamni avtomatik ulashish')
      .row()
      .text("✍️ Qo'lda kiritaman")
      .row()
      .text("⏭ O'tkazib yuborish")
      .resized()
      .oneTime();

    await ctx.reply(
      '📱 <b>Telefon raqam</b>\n\n' +
      'Mijozlar siz bilan bog\'lanishi uchun telefon raqamingiz kerak.\n\n' +
      '<i>Tugmani bosib avtomatik ulashing yoki qo\'lda kiriting.</i>',
      { parse_mode: 'HTML', reply_markup: phoneShareKb },
    );

    let phone: string | undefined;

    const phoneCtx = await conversation.wait();
    const msgText = phoneCtx.message?.text?.trim();
    const contact = phoneCtx.message?.contact;

    if (contact?.phone_number) {
      // Telegram contact share
      phone = contact.phone_number.startsWith('+')
        ? contact.phone_number
        : '+' + contact.phone_number;
      await ctx.reply(`✅ Telefon: <b>${phone}</b>`, {
        parse_mode: 'HTML',
        reply_markup: { remove_keyboard: true },
      });
    } else if (msgText && msgText !== "⏭ O'tkazib yuborish" && msgText !== "✍️ Qo'lda kiritaman") {
      // They typed a number — validate basic format
      const cleaned = msgText.replace(/\s/g, '');
      if (/^\+?[0-9]{9,15}$/.test(cleaned)) {
        phone = cleaned.startsWith('+') ? cleaned : '+' + cleaned;
        await ctx.reply(`✅ Telefon: <b>${phone}</b>`, {
          parse_mode: 'HTML',
          reply_markup: { remove_keyboard: true },
        });
      } else {
        await ctx.reply(
          "⚠️ Raqam formati noto'g'ri. Telefonsiz davom etamiz.",
          { reply_markup: { remove_keyboard: true } },
        );
      }
    } else if (msgText === "✍️ Qo'lda kiritaman") {
      // Prompt manual entry
      await ctx.reply('Telefon raqamingizni kiriting:\n<i>Masalan: +998901234567</i>', {
        parse_mode: 'HTML',
        reply_markup: { remove_keyboard: true },
      });
      const manualCtx = await conversation.waitFor(':text');
      const manual = manualCtx.message!.text.trim().replace(/\s/g, '');
      if (/^\+?[0-9]{9,15}$/.test(manual)) {
        phone = manual.startsWith('+') ? manual : '+' + manual;
        await ctx.reply(`✅ Telefon: <b>${phone}</b>`, { parse_mode: 'HTML' });
      } else {
        await ctx.reply("⚠️ Raqam noto'g'ri. Telefonsiz davom etamiz.");
      }
    } else {
      // Skipped
      await ctx.reply("⏭ Telefon ko'rsatilmagan.", {
        reply_markup: { remove_keyboard: true },
      });
    }

    // ── Step 5: Confirm ──────────────────────────────────────────────────────
    const summary =
      `📋 <b>Ma'lumotlarni tekshiring:</b>\n\n` +
      `🚗 ${carModel}  🔢 ${carNumber}` +
      `${carColor ? `  🎨 ${carColor}` : ''}\n` +
      `📱 ${phone ?? "Ko'rsatilmagan"}`;

    const confirmKb = new InlineKeyboard()
      .text('✅ Tasdiqlash', 'confirm_driver')
      .text('❌ Bekor qilish', 'cancel_driver');

    await ctx.reply(summary, { parse_mode: 'HTML', reply_markup: confirmKb });

    const confirmCbCtx = await conversation.waitForCallbackQuery(['confirm_driver', 'cancel_driver']);
    await confirmCbCtx.answerCallbackQuery();

    if (confirmCbCtx.callbackQuery.data === 'cancel_driver') {
      await confirmCbCtx.editMessageText("❌ Ro'yxatdan o'tish bekor qilindi.");
      return;
    }

    // ── Save to DB ────────────────────────────────────────────────────────────
    const driver = await conversation.external(() =>
      driversService.register({ userId: user.id, carModel, carNumber, carColor }),
    );

    await conversation.external(() =>
      usersService.setRole(user.id, 'DRIVER' as any),
    );

    if (phone) {
      await conversation.external(() =>
        usersService.updatePhone(user.id, phone!),
      );
    }

    // ── Success message + group invite ────────────────────────────────────────
    const groupLink = config.get<string>('bot.groupLink', '');

    await confirmCbCtx.editMessageText(
      `✅ <b>Ro'yxatdan o'tdingiz!</b>\n\n` +
      `🚗 ${carModel} — ${carNumber}\n` +
      `📱 ${phone ?? "Telefon ko'rsatilmagan"}\n\n` +
      `Endi buyurtmalarni qabul qila olasiz.`,
      { parse_mode: 'HTML' },
    );

    const groupKb = new InlineKeyboard();
    if (groupLink) {
      groupKb.url('📢 Guruhga qo\'shilish', groupLink);
    }

    await ctx.reply(
      `📢 <b>Muhim!</b>\n\n` +
      `Mijozlarning so'rovlarini ko'rish uchun guruhimizga qo'shiling:\n` +
      `${groupLink || 'Admin guruh linkini beradi'}\n\n` +
      `Guruhda mijoz so'rov yuborganda xabar chiqadi va siz <b>"🚗 Men kelaman"</b> tugmasini bosasiz — mijozga raqamingiz yuboriladi.`,
      { parse_mode: 'HTML', reply_markup: groupLink ? groupKb : undefined },
    );

    // ── Notify admin ──────────────────────────────────────────────────────────
    const adminIds: number[] = config.get<number[]>('bot.adminTelegramIds', []);
    if (adminIds.length > 0) {
      const adminText =
        `🆕 <b>Yangi haydovchi</b>\n\n` +
        `👤 <a href="tg://user?id=${tgUser.id}">${user.firstName}${user.lastName ? ' ' + user.lastName : ''}</a>` +
        `${user.username ? ` (@${user.username})` : ''}\n` +
        `🚗 ${carModel}  🔢 ${carNumber}${carColor ? `  🎨 ${carColor}` : ''}\n` +
        `📱 ${phone ?? "yo'q"}\n\n` +
        `<code>/block ${driver.id}</code>`;

      const adminKb = new InlineKeyboard()
        .text('🚫 Bloklash', `admin:block_driver:${driver.id}`);

      await conversation.external(() =>
        Promise.all(
          adminIds.map((id) =>
            notificationsService.sendToUserWithKeyboard(id, adminText, adminKb),
          ),
        ),
      );
    }
  };
}

async function askFreeText(
  conversation: Conversation<BotContext>,
  ctx: BotContext,
  minLen: number,
  maxLen: number,
): Promise<string> {
  let attempts = 0;
  while (attempts < 3) {
    const tCtx = await conversation.waitFor(':text');
    const value = tCtx.message!.text.trim();
    if (value.length >= minLen && value.length <= maxLen) return value;
    await ctx.reply(`❌ ${minLen}–${maxLen} belgi oralig'ida bo'lishi kerak:`);
    attempts++;
  }
  await ctx.reply("❌ Urinishlar soni tugadi. /start bosib qaytadan urinib ko'ring.");
  return '';
}
