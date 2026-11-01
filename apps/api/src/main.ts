// Phase 1: real app bootstrap. ValidationPipe rejects unknown
// body fields and validates DTOs on every route, so bad input
// is a 400 before any service logic runs.
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // CORS (2026-11-01): the web app calls this API directly from the
  // browser (status actions, photos, PDF download), so preflight
  // OPTIONS requests must be answered with an explicit allow-list.
  // Without this, browsers block every client-side mutation in
  // production while server-side page loads keep working, which
  // hid the failure. Exact origins only; override with a
  // comma-separated CORS_ORIGINS env var. No cookies are used
  // (Bearer tokens), so credentials stay off.
  const origins = (process.env.CORS_ORIGINS ??
    'https://fieldsync-apps.vercel.app,http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
