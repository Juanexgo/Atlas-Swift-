/**
 * Seed the API with the same realistic graph the web frontend ships with.
 * Run with: `pnpm --filter @atlas/api prisma db seed`
 *
 * Idempotent — re-running just upserts.
 */
import { PrismaClient } from '@prisma/client';
// Mirror the web seed generator. We keep a small copy here rather than
// import-cross-app to keep prisma's tooling happy.
import { generateApiSeed } from './seed-data';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const { nodes, edges } = generateApiSeed();
  for (const n of nodes) {
    await prisma.node.upsert({
      where: { id: n.id },
      update: {},
      create: {
        id: n.id,
        kind: n.kind,
        title: n.title,
        body: n.body,
        x: n.x,
        y: n.y,
        weight: n.weight,
        status: n.status,
        tags: JSON.stringify(n.tags),
        projectId: n.projectId,
        createdAt: BigInt(n.createdAt),
        updatedAt: BigInt(n.updatedAt),
      },
    });
  }
  for (const e of edges) {
    await prisma.edge.upsert({
      where: { id: e.id },
      update: {},
      create: {
        id: e.id,
        source: e.source,
        target: e.target,
        kind: e.kind,
        strength: e.strength,
        createdAt: BigInt(e.createdAt),
      },
    });
  }
  // eslint-disable-next-line no-console
  console.log(`Seeded ${nodes.length} nodes, ${edges.length} edges`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
