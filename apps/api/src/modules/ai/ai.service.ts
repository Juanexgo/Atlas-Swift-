/**
 * Server-side AI orchestration.
 *
 * Maintains an in-memory SearchIndex synced from the DB. On boot we
 * re-embed any nodes that don't have an embedding yet; on graph mutation
 * we re-embed lazily. For larger graphs this would move to BullMQ.
 *
 * All AI work goes through the provider abstraction in @atlas/ai, so the
 * service is agnostic to the backing model.
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  SearchIndex,
  deterministicEmbed,
  deterministicProvider,
  getCompletionProvider,
  getEmbeddingProvider,
  kmeans,
  labelCluster,
  suggestRelationships,
  summarizeNode,
  type ClusterAssignment,
  type Embedding,
  type RelationshipSuggestion,
  type SemanticHit,
} from '@atlas/ai';
import { GraphService } from '../graph/graph.service';
import type { AtlasNode } from '@atlas/types';

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger('AI');
  private readonly embeddingProvider = getEmbeddingProvider();
  private readonly completionProvider = getCompletionProvider();
  private readonly index = new SearchIndex();

  constructor(private readonly graph: GraphService) {}

  async onModuleInit(): Promise<void> {
    await this.rebuildIndex();
  }

  /** Rebuild from DB. Cheap: O(n) cosine prep. */
  async rebuildIndex(): Promise<void> {
    const rows = await this.graph.listForEmbedding();
    const entries: { id: string; embedding: Embedding }[] = [];
    const toEmbed: { id: string; text: string }[] = [];
    for (const r of rows) {
      if (r.embedding && r.embedding.length > 0) {
        entries.push({
          id: r.id,
          embedding: {
            vector: r.embedding,
            dim: r.embedding.length,
            provider: 'stored',
            version: 'cached',
          },
        });
      } else {
        toEmbed.push({ id: r.id, text: r.text });
      }
    }
    if (toEmbed.length > 0) {
      this.logger.log(`Embedding ${toEmbed.length} nodes…`);
      const vectors = await this.embeddingProvider.embed(toEmbed.map((e) => e.text));
      for (let i = 0; i < toEmbed.length; i++) {
        const emb = vectors[i]!;
        entries.push({ id: toEmbed[i]!.id, embedding: emb });
        await this.graph.saveEmbedding(
          toEmbed[i]!.id,
          emb.vector,
          this.embeddingProvider.name,
        );
      }
    }
    this.index.build(entries);
    this.logger.log(`Index ready: ${this.index.size()} entries`);
  }

  search(query: string, k = 8): SemanticHit[] {
    if (!query.trim()) return [];
    // We embed the query ourselves to avoid an async hop on every keystroke.
    // The deterministic provider is pure — this is a single hash pass.
    const v = deterministicEmbed(query);
    return this.index.search(v, k, 0.5);
  }

  similar(id: string, k = 8): SemanticHit[] {
    return this.index.similarTo(id, k);
  }

  async clusters(k?: number): Promise<{
    assignment: ClusterAssignment;
    labels: string[];
  }> {
    const rows = await this.graph.listForEmbedding();
    const entries: { id: string; embedding: Embedding; title: string }[] = [];
    for (const r of rows) {
      if (!r.embedding || r.embedding.length === 0) continue;
      entries.push({
        id: r.id,
        title: r.text.split('\n')[0]!,
        embedding: {
          vector: r.embedding,
          dim: r.embedding.length,
          provider: 'stored',
          version: 'cached',
        },
      });
    }
    const assignment = kmeans(entries, { k });
    // Label each cluster by its members' titles. This is the only place
    // a completion provider is invoked in this method.
    const idToTitle = new Map(entries.map((e) => [e.id, e.title]));
    const labels = await Promise.all(
      assignment.byCluster.map((ids) =>
        labelCluster(
          this.completionProvider,
          ids.map((id) => idToTitle.get(id) ?? ''),
        ).catch(() => 'cluster'),
      ),
    );
    return { assignment, labels };
  }

  async suggest(): Promise<RelationshipSuggestion[]> {
    const rows = await this.graph.listForEmbedding();
    const edges = await this.graph.listEdges();
    const entries = rows
      .filter((r) => r.embedding && r.embedding.length > 0)
      .map((r) => ({
        id: r.id,
        embedding: {
          vector: r.embedding!,
          dim: r.embedding!.length,
          provider: 'stored',
          version: 'cached',
        },
      }));
    return suggestRelationships(entries, edges, { perNode: 3, minScore: 0.82 });
  }

  async summarize(nodeId: string): Promise<string> {
    const node = await this.graph.getNode(nodeId);
    const hits = this.similar(nodeId, 5);
    const related: string[] = [];
    for (const h of hits) {
      const n = await this.tryGet(node.id, h.id);
      if (n) related.push(`${n.title} (${n.kind})`);
    }
    return summarizeNode(this.completionProvider, { node, related });
  }

  private async tryGet(_origin: string, id: string): Promise<AtlasNode | null> {
    return this.graph.getNode(id).catch(() => null);
  }
}
