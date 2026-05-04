import { Module } from '@nestjs/common';
import { StatsController } from './stats.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [StatsController],
})
export class StatsModule {}
