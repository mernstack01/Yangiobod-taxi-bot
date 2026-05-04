export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    url: process.env.DATABASE_URL,
  },
  bot: {
    token: process.env.BOT_TOKEN ?? '',
    adminTelegramIds: (process.env.ADMIN_TELEGRAM_IDS ?? '')
      .split(',')
      .filter(Boolean)
      .map((id) => parseInt(id.trim(), 10)),
    groupId: process.env.TELEGRAM_GROUP_ID
      ? parseInt(process.env.TELEGRAM_GROUP_ID.trim(), 10)
      : null,
    groupLink: process.env.TELEGRAM_GROUP_LINK ?? '',
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
  listing: {
    expiryHours: parseInt(process.env.LISTING_EXPIRY_HOURS ?? '2', 10),
    clientCooldownMinutes: parseInt(process.env.CLIENT_LISTING_COOLDOWN_MINUTES ?? '10', 10),
  },
  driver: {
    cooldownMinutes: parseInt(process.env.DRIVER_COOLDOWN_MINUTES ?? '5', 10),
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'change_this_secret',
    expiresIn: '7d',
  },
  adminPanelUrl: process.env.ADMIN_PANEL_URL ?? 'http://localhost:3001',
});
