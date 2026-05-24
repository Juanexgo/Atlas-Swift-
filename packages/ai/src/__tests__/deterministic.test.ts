import { describe, it, expect } from 'vitest';
import { deterministicEmbed } from '../providers/deterministic';
import { dot, l2norm } from '../vector';

describe('deterministic embeddings', () => {
  it('is stable for identical input', () => {
    const a = deterministicEmbed('Atlas spatial knowledge OS');
    const b = deterministicEmbed('Atlas spatial knowledge OS');
    for (let i = 0; i < a.length; i++) expect(a[i]).toBe(b[i]);
  });

  it('produces unit-length vectors', () => {
    const v = deterministicEmbed('some random text');
    expect(l2norm(v)).toBeCloseTo(1, 5);
  });

  it('is similarity-sensitive: paraphrases beat unrelated', () => {
    const q = deterministicEmbed('atlas spatial knowledge graph');
    const near = deterministicEmbed('atlas knowledge graph spatial');
    const far = deterministicEmbed('pizza toppings recipe weeknight');
    expect(dot(q, near)).toBeGreaterThan(dot(q, far));
  });

  it('empty input is non-degenerate', () => {
    const v = deterministicEmbed('');
    expect(l2norm(v)).toBeCloseTo(1, 5);
  });
});
