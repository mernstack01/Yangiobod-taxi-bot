import { InlineKeyboard, Keyboard } from 'grammy';
import { Driver, DriverStatus, RegistrationStatus, User } from '@prisma/client';

// ── Persistent bottom keyboard (always visible in chat) ──────────────────────

export function buildReplyKeyboard(user: User, driver?: Driver | null): Keyboard {
  const kb = new Keyboard();

  if (driver?.status === RegistrationStatus.BLOCKED) {
    return kb.text('👤 Profil').text('📢 Guruh').resized().persistent();
  }

  kb.text("🚖 Taksi so'rash").text("📊 Bo'sh taxilar").row();

  if (!driver) {
    kb.text("🚗 Haydovchi bo'lish").text('👤 Profil').row();
  } else if (driver.status === RegistrationStatus.PENDING) {
    kb.text('⏳ Ariza holati').text('👤 Profil').row();
  } else {
    // ACTIVE driver
    kb.text(buildDriverStatusLabel(driver)).row();
    kb.text("📋 Mening e'lonlarim").text('👤 Profil').row();
  }

  kb.text('📢 Guruh');

  return kb.resized().persistent();
}

// ── Inline keyboard for /start welcome message ───────────────────────────────

export function buildMainMenu(user: User, driver?: Driver | null): InlineKeyboard {
  const kb = new InlineKeyboard();

  if (driver?.status === RegistrationStatus.BLOCKED) {
    return kb.text('❌ Bloklangansiz', 'show_blocked_info');
  }

  kb.text("🚖 Taksi so'rash", 'request_taxi').row();
  kb.text("📊 Bo'sh taxilar", 'show_available_taxis').row();

  if (!driver) {
    kb.text("🚗 Haydovchi bo'lish", 'become_driver');
  } else if (driver.status === RegistrationStatus.PENDING) {
    kb.text('⏳ Tasdiqlash kutilmoqda', 'show_pending_info');
  } else {
    kb.text(buildStatusButtonText(driver), 'toggle_availability').row();
    kb.text("📋 Mening e'lonlarim", 'my_listings').text('👤 Profil', 'profile');
  }

  return kb;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildDriverStatusLabel(driver: Driver): string {
  switch (driver.currentStatus) {
    case DriverStatus.OFFLINE:    return '🔴 Holat: Yopiq — yoqish';
    case DriverStatus.AVAILABLE:  return `🟢 Holat: Bo'shman (${driver.availableSeats} joy)`;
    case DriverStatus.ON_TRIP:    return "🚗 Holat: Yo'ldaman";
    case DriverStatus.BREAK:      return '☕ Holat: Tanaffus';
  }
}

function buildStatusButtonText(driver: Driver): string {
  return buildDriverStatusLabel(driver);
}
