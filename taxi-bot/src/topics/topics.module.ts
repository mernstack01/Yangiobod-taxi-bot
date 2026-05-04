import { Module } from '@nestjs/common';
import { TopicsController } from './topics.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TopicsController],
})
export class TopicsModule {}
