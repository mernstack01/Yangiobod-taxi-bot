import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, lazySession } from 'grammy';
import { conversations } from '@grammyjs/conversations';
import { RedisAdapter } from '@grammyjs/storage-redis';
import { Redis } from 'ioredis';
import { BotContext, SessionData } from './bot.context';

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotService.name);
  private readonly _bot: Bot<BotContext>;
  private readonly redis: Redis;

  constructor(private readonly config: ConfigService) {
    const token = this.config.getOrThrow<string>('BOT_TOKEN');
    const redisUrl = this.config.get<string>('REDIS_URL', 'redis://localhost:6379');

    this._bot = new Bot<BotContext>(token);
    this.redis = new Redis(redisUrl);

    // lazySession is required by @grammyjs/conversations — it reads/writes session
    // lazily so conversations can merge their own data into the same Redis key.
    this._bot.use(
      lazySession({
        initial: (): SessionData => ({}),
        storage: new RedisAdapter({ instance: this.redis }),
      }),
    );

    // Conversations plugin must come after session
    this._bot.use(conversations());

    // Catch all unhandled errors and print them so they are never silently swallowed
    this._bot.catch((err) => {
      this.logger.error(
        `Unhandled bot error for update ${err.ctx?.update?.update_id}: ${err.message}`,
        err.stack,
      );
    });
  }

  get bot(): Bot<BotContext> {
    return this._bot;
  }

  // Lifecycle hook exists but does not start the bot.
  // BotUpdate.onModuleInit registers all handlers first, then calls bot.start().
  onModuleInit(): void {
    this.logger.log('BotService initialized');
  }

  async onModuleDestroy() {
    await this._bot.stop();
    this.redis.disconnect();
    this.logger.log('Bot stopped');
  }
}
