import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './common/config/configuration';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuditModule } from './common/audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BotModule } from './bot/bot.module';
import { UsersModule } from './users/users.module';
import { DriversModule } from './drivers/drivers.module';
import { ListingsModule } from './listings/listings.module';
import { LocationsModule } from './locations/locations.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TopicsModule } from './topics/topics.module';
import { StatsModule } from './stats/stats.module';
import { SettingsModule } from './settings/settings.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [configuration],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditModule,
    AuthModule,
    BotModule,
    UsersModule,
    DriversModule,
    ListingsModule,
    LocationsModule,
    NotificationsModule,
    TopicsModule,
    StatsModule,
    SettingsModule,
    HealthModule,
  ],
})
export class AppModule {}
