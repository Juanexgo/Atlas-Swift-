import { describe, it, expect } from 'vitest';
import {
  bulkSeed,
  getGraphDoc,
  patchNode,
  readNode,
  snapshotGraph,
  upsertNode,
} from '../index';
import type { AtlasNode } from '@atlas/types';

function fixture(id: string, overrides: Partial<AtlasNode> = {}): AtlasNode {
  return {
    id,
    kind: 'note',
    title: `node ${id}`,
    body: '',
    x: 0,
    y: 0,
    weight: 0.5,
    status: 'active',
    tags: [],
    projectId: null,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe('crdt round-trip', () => {
  it('upsert + read preserves shape', () => {
    const c = getGraphDoc('test:rt:1');
    upsertNode(c, fixture('a', { title: 'hello' }));
    const yNode = c.nodes.get('a')!;
    expect(readNode(yNode).title).toBe('hello');
    c.destroy();
  });

  it('bulkSeed then snapshot matches input', () => {
    const c = getGraphDoc('test:rt:2');
    const inputNodes = [fixture('a'), fixture('b', { title: 'second' })];
    bulkSeed(c, { nodes: inputNodes, edges: [] });
    const snap = snapshotGraph(c);
    expect(snap.nodes.length).toBe(2);
    const titles = snap.nodes.map((n) => n.title).sort();
    expect(titles).toEqual(['node a', 'second']);
    c.destroy();
  });

  it('patchNode updates only the touched fields + updatedAt', () => {
    const c = getGraphDoc('test:rt:3');
    upsertNode(c, fixture('a', { title: 'before', body: 'body', updatedAt: 0 }));
    patchNode(c, 'a', { title: 'after' });
    const yNode = c.nodes.get('a')!;
    const n = readNode(yNode);
    expect(n.title).toBe('after');
    expect(n.body).toBe('body');
    expect(n.updatedAt).toBeGreaterThan(0);
    c.destroy();
  });
});
