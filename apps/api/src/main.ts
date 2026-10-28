// Phase 0 placeholder — replaced in Phase 1 by the real NestJS app module,
// Clerk verification, guards, and jobs module. Kept minimal on purpose:
// claiming a working API here would be false.
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
