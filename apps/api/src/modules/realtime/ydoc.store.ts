/**
 * Server-side Yjs doc registry. Hot docs live in memory; periodically
 * snapshotted to the YDocSnapshot table so clients reconnecting after a
 * server restart re-hydrate.
 *
 * For one-tenant Atlas we only ever hold one doc. The map is here so the
 * gateway code generalizes to multi-tenant later without a refactor.
 */
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as Y from 'yjs';
import { PrismaService } from '../../infra/prisma/prisma.service';

const SNAPSHOT_INTERVAL_MS = 15_000;

@Injectable()
export class YDocStore implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('YDocStore');
  private readonly docs = new Map<string, Y.Doc>();
  private snapshotTimer: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    this.snapshotTimer = setInterval(() => this.snapshotAll().catch(() => undefined), SNAPSHOT_INTERVAL_MS);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.snapshotTimer) clearInterval(this.snapshotTimer);
    await this.snapshotAll();
    for (const doc of this.docs.values()) doc.destroy();
    this.docs.clear();
  }

  async getOrCreate(id: string): Promise<Y.Doc> {
    const existing = this.docs.get(id);
    if (existing) return existing;
    const doc = new Y.Doc({ guid: id });
    const snap = await this.prisma.yDocSnapshot.findUnique({ where: { id } });
    if (snap?.data) {
      try {
        Y.applyUpdate(doc, new Uint8Array(snap.data));
      } catch (err) {
        this.logger.warn(`Snapshot for ${id} failed to apply: ${(err as Error).message}`);
      }
    }
    this.docs.set(id, doc);
    return doc;
  }

  private async snapshotAll(): Promise<void> {
    for (const [id, doc] of this.docs.entries()) {
      const state = Y.encodeStateAsUpdate(doc);
      await this.prisma.yDocSnapshot.upsert({
        where: { id },
        create: { id, data: Buffer.from(state) },
        update: { data: Buffer.from(state) },
      });
    }
  }
}
