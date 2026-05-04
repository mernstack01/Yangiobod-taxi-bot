import { Module } from '@nestjs/common';
import { ListingsService } from './listings.service';
import { ListingsCronService } from './listings-cron.service';
import { ListingsController } from './listings.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ListingsController],
  providers: [ListingsService, ListingsCronService],
  exports: [ListingsService, ListingsCronService],
})
export class ListingsModule {}
