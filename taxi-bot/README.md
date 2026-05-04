# Taxi Bot

NestJS va grammY asosida qurilgan Telegram taksi boti.

## Texnologiyalar

- **NestJS 10+** — backend framework
- **grammY** — Telegram Bot API kutubxonasi
- **Prisma** — PostgreSQL ORM
- **Redis** — sessiya saqlash (ioredis)
- **Docker Compose** — lokal infratuzilma

---

## O'rnatish va ishga tushirish

### 1. Talablar

- Node.js 20+
- Docker va Docker Compose
- Telegram bot tokeni (`@BotFather` orqali oling)

### 2. Loyihani klonlash

```bash
git clone <repo-url>
cd taxi-bot
```

### 3. Muhit o'zgaruvchilarini sozlash

```bash
cp .env.example .env
```

`.env` faylini oching va quyidagi qiymatlarni to'ldiring:

| O'zgaruvchi             | Tavsif                                          |
|-------------------------|-------------------------------------------------|
| `DATABASE_URL`          | PostgreSQL ulanish manzili                      |
| `BOT_TOKEN`             | Telegram bot tokeni                             |
| `ADMIN_TELEGRAM_IDS`    | Admin Telegram ID lari (vergul bilan ajratilgan)|
| `REDIS_URL`             | Redis ulanish manzili                           |
| `LISTING_EXPIRY_HOURS`  | E'lon amal qilish muddati (soat, standart: 24)  |
| `DRIVER_COOLDOWN_MINUTES` | Haydovchi cooldown vaqti (daqiqa, standart: 5) |

### 4. Docker konteynerlari ishga tushirish

```bash
docker compose up -d
```

Bu PostgreSQL (port 5432) va Redis (port 6379) ni ishga tushiradi.

### 5. Paketlarni o'rnatish

```bash
npm install
```

### 6. Ma'lumotlar bazasini sozlash

```bash
# Prisma client generatsiya qilish
npm run prisma:generate

# Migratsiyalarni qo'llash
npm run prisma:migrate

# Boshlang'ich ma'lumotlarni yuklash (adminlar)
npm run prisma:seed
```

### 7. Botni ishga tushirish

```bash
# Ishlab chiqish rejimi
npm run start:dev

# Production
npm run build
npm run start:prod
```

---

## Loyiha tuzilmasi

```
src/
├── main.ts                    # Kirish nuqtasi
├── app.module.ts              # Asosiy modul
├── common/
│   ├── prisma/                # Prisma modul va servis
│   └── config/                # Konfiguratsiya fayllari
├── bot/
│   ├── bot.module.ts
│   ├── bot.service.ts         # Bot instance
│   ├── bot.update.ts          # Komandalar handler
│   ├── scenes/                # grammY conversations
│   ├── keyboards/             # Inline/Reply klaviaturalar
│   └── handlers/              # Alohida handler fayllari
├── users/                     # Foydalanuvchi moduli
├── drivers/                   # Haydovchi moduli
├── listings/                  # E'lon moduli
├── locations/                 # Joylashuv yordamchi servisi
└── notifications/             # Bildirishnoma servisi
prisma/
├── schema.prisma              # Ma'lumotlar bazasi sxemasi
└── seed.ts                    # Boshlang'ich ma'lumotlar
```

---

## Foydali buyruqlar

```bash
# Prisma Studio (vizual DB editor)
npm run prisma:studio

# Kod formatlash
npm run format

# Testlarni ishga tushirish
npm run test
```

---

## Litsenziya

MIT
# Yangiobod-taxi-bot
