import { Global, Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { BotUpdate } from './bot.update';
import { UsersModule } from '../users/users.module';
import { DriversModule } from '../drivers/drivers.module';
import { ListingsModule } from '../listings/listings.module';
import { LocationsModule } from '../locations/locations.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Global()
@Module({
  imports: [UsersModule, DriversModule, ListingsModule, LocationsModule, NotificationsModule],
  providers: [BotService, BotUpdate],
  exports: [BotService],
})
export class BotModule {}
