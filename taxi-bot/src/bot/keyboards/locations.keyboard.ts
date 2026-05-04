import { InlineKeyboard } from 'grammy';
import { Location } from '@prisma/client';

export function buildLocationsKeyboard(
  locations: Location[],
  prefix: string,
  exclude?: string,
): InlineKeyboard {
  const kb = new InlineKeyboard();
  const filtered = locations.filter((l) => l.id !== exclude);
  filtered.forEach((loc, i) => {
    kb.text(loc.name, `${prefix}:${loc.id}`);
    if ((i + 1) % 2 === 0) kb.row();
  });
  return kb;
}
