/**
 * In-memory semantic search.
 *
 * For graphs of thousands of nodes, exhaustive cosine is plenty fast
 * (~1ms for 1k nodes × 256 dim on modern hardware) and avoids the
 * complexity of HNSW/IVF until we cross 100k+ nodes.
 *
 * Index shape: parallel arrays for cache friendliness in the hot loop.
 */
import { dot } from './vector';
import type { Embedding, SemanticHit } from './types';

export class SearchIndex {
  private ids: string[] = [];
  private vectors: Float32Array[] = [];
  private dim = 0;

  size(): number {
    return this.ids.length;
  }

  /** Replace the index. O(n). */
  build(entries: { id: string; embedding: Embedding }[]): void {
    if (entries.length === 0) {
      this.ids = [];
      this.vectors = [];
      this.dim = 0;
      return;
    }
    this.dim = entries[0]!.embedding.dim;
    this.ids = entries.map((e) => e.id);
    this.vectors = entries.map((e) => e.embedding.vector);
  }

  /** Add or update one entry. O(n) worst-case due to id scan. */
  upsert(id: string, embedding: Embedding): void {
    if (this.dim === 0) this.dim = embedding.dim;
    const idx = this.ids.indexOf(id);
    if (idx === -1) {
      this.ids.push(id);
      this.vectors.push(embedding.vector);
    } else {
      this.vectors[idx] = embedding.vector;
    }
  }

  remove(id: string): void {
    const idx = this.ids.indexOf(id);
    if (idx === -1) return;
    this.ids.splice(idx, 1);
    this.vectors.splice(idx, 1);
  }

  /**
   * Return top-k by cosine similarity. Scores assumed to be in [-1, 1] for
   * normalized vectors; we clamp/transform to [0, 1] for UI consumption.
   */
  search(query: Float32Array, k: number = 8, minScore = 0): SemanticHit[] {
    const n = this.ids.length;
    if (n === 0) return [];
    const heap: SemanticHit[] = [];
    for (let i = 0; i < n; i++) {
      const raw = dot(query, this.vectors[i]!);
      const score = (raw + 1) * 0.5; // map [-1,1] → [0,1]
      if (score < minScore) continue;
      if (heap.length < k) {
        heap.push({ id: this.ids[i]!, score });
        heap.sort((a, b) => a.score - b.score);
      } else if (score > heap[0]!.score) {
        heap[0] = { id: this.ids[i]!, score };
        heap.sort((a, b) => a.score - b.score);
      }
    }
    return heap.reverse();
  }

  /** Find similar items to a given id (excluding itself). */
  similarTo(id: string, k: number = 8): SemanticHit[] {
    const idx = this.ids.indexOf(id);
    if (idx === -1) return [];
    return this.search(this.vectors[idx]!, k + 1).filter((h) => h.id !== id).slice(0, k);
  }
}
