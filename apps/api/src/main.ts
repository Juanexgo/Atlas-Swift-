/**
 * Atlas API entrypoint.
 *
 * Single Nest application listening on PORT (default 4001). The y-websocket
 * gateway shares the same HTTP server via the WS adapter, so realtime collab
 * is reachable at ws://localhost:4001/realtime.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  app.useWebSocketAdapter(new WsAdapter(app));

  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3001')
    .split(',')
    .map((s) => s.trim());
  app.enableCors({
    origin: origins,
    credentials: true,
  });

  // Validation is enforced per-route via Zod (see modules/graph/dto.ts).
  // We deliberately don't enable class-validator's ValidationPipe to keep
  // a single source of truth (zod) and avoid the runtime peer.

  const port = Number(process.env.PORT ?? 4001);
  await app.listen(port);
  new Logger('Bootstrap').log(`Atlas API ready on :${port}`);
}

bootstrap().catch((err) => {
  // Fatal — print and exit non-zero so process supervisors restart.
  // eslint-disable-next-line no-console
  console.error('Failed to start Atlas API', err);
  process.exit(1);
});
