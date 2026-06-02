import { beforeAll, afterEach, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

// Force test client + dedicated SQLite file before any code under test loads.
process.env.NODE_ENV = 'test';
process.env.PRISMA_TEST_CLIENT = '1';
process.env.JWT_SECRET = 'test-secret';
process.env.UPLOADS_DIR = path.resolve(__dirname, '.uploads-test');
process.env.ENABLE_SCHEDULER = '0';

const dbPath = path.resolve(__dirname, '..', 'prisma', 'test.db');

beforeAll(() => {
  // Recreate uploads dir.
  fs.rmSync(process.env.UPLOADS_DIR!, { recursive: true, force: true });
  fs.mkdirSync(process.env.UPLOADS_DIR!, { recursive: true });

  // Wipe sqlite file before generating fresh schema.
  if (fs.existsSync(dbPath)) fs.rmSync(dbPath);
  // Schema + client are produced by `npm run prisma:generate:test` + `prisma:push:test`
  // (run by `npm test` before vitest starts), so by here both are in place.
  // Belt-and-suspenders: re-push if file is missing (e.g. running vitest directly).
  if (!fs.existsSync(dbPath)) {
    execSync('npx prisma db push --schema=prisma/schema.test.prisma --skip-generate', {
      stdio: 'ignore',
      cwd: path.resolve(__dirname, '..'),
    });
  }
});

afterEach(async () => {
  // Truncate all tables between tests via raw SQL.
  const { getPrisma } = await import('../src/utils/prisma');
  const prisma = getPrisma();
  await prisma.$executeRawUnsafe('DELETE FROM ChatMessage');
  await prisma.$executeRawUnsafe('DELETE FROM DinnerSession');
  await prisma.$executeRawUnsafe('DELETE FROM Material');
  await prisma.$executeRawUnsafe('DELETE FROM FamilyMember');
  await prisma.$executeRawUnsafe('DELETE FROM FamilySpace');
  await prisma.$executeRawUnsafe('DELETE FROM User');

  const { resetAiService } = await import('../src/services/ai');
  resetAiService();
});

afterAll(async () => {
  const { disconnectPrisma } = await import('../src/utils/prisma');
  await disconnectPrisma();
});
