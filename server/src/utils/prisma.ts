// Prisma client wrapper. In tests we route to the SQLite generator output
// (../node_modules/.prisma/client-test) by setting PRISMA_TEST_CLIENT=1.
//
// Both clients share the same model surface so the rest of the codebase
// can import a single `prisma` instance.

let cached: any = null;

export function getPrisma(): any {
  if (cached) return cached;

  if (process.env.PRISMA_TEST_CLIENT === '1') {
    // Test path: use the SQLite client generated from schema.test.prisma.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PrismaClient } = require('../../node_modules/.prisma/client-test');
    cached = new PrismaClient();
  } else {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PrismaClient } = require('@prisma/client');
    cached = new PrismaClient();
  }
  return cached;
}

export async function disconnectPrisma(): Promise<void> {
  if (cached && typeof cached.$disconnect === 'function') {
    await cached.$disconnect();
    cached = null;
  }
}
