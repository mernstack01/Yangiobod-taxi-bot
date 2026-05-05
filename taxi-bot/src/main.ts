import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

// BigInt is not JSON-serializable by default — convert to string
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const adminUrl = app.get(ConfigService).get<string>('ADMIN_PANEL_URL', 'http://localhost:3001');
  const allowedOrigins = [
    adminUrl,
    'https://yangiobod-taxi-bot.vercel.app',
  ].filter(Boolean);
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  const port = app.get(ConfigService).get<number>('PORT', 3000);
  await app.listen(port);
  logger.log(`HTTP server listening on port ${port}`);
}

bootstrap();
