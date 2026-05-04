import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { TopicBroadcasterService } from './topic-broadcaster.service';
import { ListingsModule } from '../listings/listings.module';

@Module({
  imports: [ListingsModule],
  providers: [NotificationsService, TopicBroadcasterService],
  exports: [NotificationsService, TopicBroadcasterService],
})
export class NotificationsModule {}
