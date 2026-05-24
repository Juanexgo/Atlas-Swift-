import { describe, it, expect } from 'vitest';
import { kmeans, suggestK } from '../cluster';
import { deterministicEmbed } from '../providers/deterministic';

describe('kmeans', () => {
  it('produces consistent bookkeeping for arbitrary inputs', () => {
    // We don't assert on cluster *contents* — with hash-trick embeddings
    // separation is noise-sensitive on small inputs. We assert on the
    // structural invariants the rest of the pipeline relies on.
    const docs = Array.from({ length: 10 }, (_, i) => `doc number ${i} content ${i * 7}`);
    const entries = docs.map((t, i) => ({
      id: `n${i}`,
      embedding: {
        vector: deterministicEmbed(t),
        dim: 256,
        provider: 'deterministic',
        version: 'v1',
      },
    }));
    const result = kmeans(entries, { k: 3, seed: 7 });

    // Every node has an assignment.
    for (const e of entries) expect(result.byNode.has(e.id)).toBe(true);

    // Reverse index sums match.
    const totalMembers = result.byCluster.reduce((s, ids) => s + ids.length, 0);
    expect(totalMembers).toBe(entries.length);

    // Centroids have the right shape.
    expect(result.centroids.length).toBe(3);
    for (const c of result.centroids) expect(c.length).toBe(256);

    // byNode and byCluster agree.
    for (let c = 0; c < result.byCluster.length; c++) {
      for (const id of result.byCluster[c]!) {
        expect(result.byNode.get(id)).toBe(c);
      }
    }
  });

  it('seeded runs are reproducible', () => {
    const docs = Array.from({ length: 12 }, (_, i) => `doc ${i} unique content ${i}`);
    const entries = docs.map((t, i) => ({
      id: `n${i}`,
      embedding: {
        vector: deterministicEmbed(t),
        dim: 256,
        provider: 'deterministic',
        version: 'v1',
      },
    }));
    const a = kmeans(entries, { k: 3, seed: 42 });
    const b = kmeans(entries, { k: 3, seed: 42 });
    for (const e of entries) {
      expect(a.byNode.get(e.id)).toBe(b.byNode.get(e.id));
    }
  });

  it('suggestK is sane', () => {
    expect(suggestK(0)).toBe(2);
    expect(suggestK(8)).toBeGreaterThanOrEqual(2);
    expect(suggestK(10_000)).toBeLessThanOrEqual(16);
  });
});
