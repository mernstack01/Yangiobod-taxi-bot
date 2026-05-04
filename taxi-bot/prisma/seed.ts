import { PrismaClient, UserRole, LocationTier, AdminRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const LOCATIONS: {
  name: string;
  shortCode: string;
  region: string;
  sortOrder: number;
  tier: LocationTier;
}[] = [
  { name: 'Balandchaqir',  shortCode: 'BCH', region: 'Jizzax',   sortOrder: 1,  tier: LocationTier.CENTER  },
  { name: 'Yangiyer',      shortCode: 'YNG', region: 'Sirdaryo', sortOrder: 2,  tier: LocationTier.CITY    },
  { name: 'Dashtobod',     shortCode: 'DSH', region: 'Jizzax',   sortOrder: 3,  tier: LocationTier.CITY    },
  { name: 'Zomin',         shortCode: 'ZOM', region: 'Jizzax',   sortOrder: 4,  tier: LocationTier.CITY    },
  { name: 'Jizzax',        shortCode: 'JIZ', region: 'Jizzax',   sortOrder: 5,  tier: LocationTier.CITY    },
  { name: 'Xovos',         shortCode: 'XOV', region: 'Sirdaryo', sortOrder: 6,  tier: LocationTier.CITY    },
  { name: 'Guliston',      shortCode: 'GUL', region: 'Sirdaryo', sortOrder: 7,  tier: LocationTier.CITY    },
  { name: 'Toshkent',      shortCode: 'TSH', region: 'Toshkent', sortOrder: 8,  tier: LocationTier.CITY    },
  { name: "Mug'ol",        shortCode: 'MGL', region: 'Jizzax',   sortOrder: 9,  tier: LocationTier.VILLAGE },
  { name: "Xo'jamushkent", shortCode: 'XJM', region: 'Jizzax',   sortOrder: 10, tier: LocationTier.VILLAGE },
  { name: 'Saydon',        shortCode: 'SYD', region: 'Jizzax',   sortOrder: 11, tier: LocationTier.VILLAGE },
  { name: 'Yangiobod',     shortCode: 'YOB', region: 'Jizzax',   sortOrder: 12, tier: LocationTier.VILLAGE },
];

async function main() {
  console.log('Seeding locations...');

  for (const loc of LOCATIONS) {
    await prisma.location.upsert({
      where: { name: loc.name },
      update: { sortOrder: loc.sortOrder, tier: loc.tier },
      create: { name: loc.name, sortOrder: loc.sortOrder, tier: loc.tier },
    });
  }

  console.log(`Seeded ${LOCATIONS.length} locations.`);

  // ── Routes ────────────────────────────────────────────────────────────────
  console.log('Seeding routes...');

  const allLocations = await prisma.location.findMany();
  const loc = (name: string) => {
    const found = allLocations.find((l) => l.name === name);
    if (!found) throw new Error(`Location not found: ${name}`);
    return found;
  };

  const ROUTE_PAIRS: { from: string; to: string; stops: string[] }[] = [
    {
      from: 'Balandchaqir',
      to: 'Guliston',
      stops: ['Dashtobod', 'Xovos', 'Yangiyer'],
    },
    {
      from: 'Balandchaqir',
      to: 'Jizzax',
      stops: ['Dashtobod'],
    },
    {
      from: 'Balandchaqir',
      to: 'Yangiyer',
      stops: ['Dashtobod', 'Xovos'],
    },
    {
      from: 'Balandchaqir',
      to: 'Toshkent',
      stops: ['Dashtobod', 'Xovos', 'Yangiyer', 'Guliston'],
    },
    {
      from: 'Balandchaqir',
      to: 'Zomin',
      stops: ['Dashtobod'],
    },
    {
      from: 'Yangiyer',
      to: 'Jizzax',
      stops: ['Xovos', 'Dashtobod'],
    },
    {
      from: 'Yangiyer',
      to: 'Toshkent',
      stops: ['Guliston'],
    },
    {
      from: 'Guliston',
      to: 'Toshkent',
      stops: [],
    },
  ];

  let routeCount = 0;

  for (const pair of ROUTE_PAIRS) {
    const fromLoc = loc(pair.from);
    const toLoc = loc(pair.to);
    const stopIds = pair.stops.map((s) => loc(s).id);

    await prisma.route.upsert({
      where: { fromId_toId: { fromId: fromLoc.id, toId: toLoc.id } },
      update: { stops: stopIds, isActive: true },
      create: { fromId: fromLoc.id, toId: toLoc.id, stops: stopIds },
    });
    routeCount++;

    await prisma.route.upsert({
      where: { fromId_toId: { fromId: toLoc.id, toId: fromLoc.id } },
      update: { stops: [...stopIds].reverse(), isActive: true },
      create: { fromId: toLoc.id, toId: fromLoc.id, stops: [...stopIds].reverse() },
    });
    routeCount++;
  }

  console.log(`Seeded ${routeCount} routes.`);

  // ── Telegram Admins ───────────────────────────────────────────────────────
  const adminIds = (process.env.ADMIN_TELEGRAM_IDS ?? '')
    .split(',')
    .filter(Boolean)
    .map((id) => BigInt(id.trim()));

  for (const telegramId of adminIds) {
    await prisma.user.upsert({
      where: { telegramId },
      update: { role: UserRole.ADMIN },
      create: { telegramId, firstName: 'Admin', role: UserRole.ADMIN },
    });
    console.log(`Upserted admin: ${telegramId}`);
  }

  // ── Web Admin User ────────────────────────────────────────────────────────
  console.log('Seeding admin user...');

  const passwordHash = await bcrypt.hash('admin123', 12);

  await prisma.adminUser.upsert({
    where: { email: 'admin@taxi.uz' },
    update: {},
    create: {
      email: 'admin@taxi.uz',
      passwordHash,
      name: 'Super Admin',
      role: AdminRole.SUPER_ADMIN,
    },
  });

  console.log('Seeded admin user: admin@taxi.uz / admin123 (CHANGE PASSWORD IMMEDIATELY)');

  // ── Topic placeholders ────────────────────────────────────────────────────
  // topicId = 0 and isActive = false until admin sets real Telegram topic IDs
  console.log('Seeding topic placeholders...');

  const cityLocations = allLocations.filter(
    (l) => l.tier === LocationTier.CENTER || l.tier === LocationTier.CITY,
  );

  for (const cl of cityLocations) {
    await prisma.topic.upsert({
      where: { locationId: cl.id },
      update: {},
      create: { locationId: cl.id, topicId: 0, isActive: false },
    });
  }

  console.log(
    `Created ${cityLocations.length} topic placeholders. Set actual topicIds via admin panel.`,
  );

  console.log('Seeding complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
