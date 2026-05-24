import { describe, it, expect } from 'vitest';
import { SearchIndex } from '../search';
import { deterministicEmbed } from '../providers/deterministic';

function entry(id: string, text: string) {
  return {
    id,
    embedding: {
      vector: deterministicEmbed(text),
      dim: 256,
      provider: 'deterministic',
      version: 'v1',
    },
  };
}

describe('SearchIndex', () => {
  it('top hit for exact match wins', () => {
    const idx = new SearchIndex();
    idx.build([
      entry('a', 'graph rendering with three.js'),
      entry('b', 'pizza toppings recipe'),
      entry('c', 'spatial knowledge operating system'),
    ]);
    const hits = idx.search(deterministicEmbed('spatial knowledge operating system'), 3);
    expect(hits[0]?.id).toBe('c');
  });

  it('respects minScore', () => {
    const idx = new SearchIndex();
    idx.build([entry('a', 'totally unrelated query target'), entry('b', 'pancake batter')]);
    const hits = idx.search(deterministicEmbed('xylophone aurora penguin'), 3, 0.95);
    expect(hits.length).toBe(0);
  });

  it('similarTo excludes the source', () => {
    const idx = new SearchIndex();
    idx.build([
      entry('a', 'graph rendering with three.js'),
      entry('b', 'three.js graph rendering'),
      entry('c', 'unrelated topic'),
    ]);
    const hits = idx.similarTo('a', 2);
    expect(hits.find((h) => h.id === 'a')).toBeUndefined();
    expect(hits[0]?.id).toBe('b');
  });

  it('upsert + remove maintain consistency', () => {
    const idx = new SearchIndex();
    idx.upsert('a', entry('a', 'one').embedding);
    idx.upsert('b', entry('b', 'two').embedding);
    expect(idx.size()).toBe(2);
    idx.remove('a');
    expect(idx.size()).toBe(1);
    const hits = idx.search(deterministicEmbed('one'), 5);
    expect(hits.find((h) => h.id === 'a')).toBeUndefined();
  });
});
