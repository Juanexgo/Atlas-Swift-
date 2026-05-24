/**
 * Local copy of @atlas/types. Mobile lives outside the pnpm workspace
 * (RN 0.76 pins React 18, the web is on React 19), so we can't `workspace:*`
 * the shared package. The shape mirrors packages/types/src/index.ts —
 * keep in sync if you add new node kinds.
 */
export type NodeKind =
  | 'note'
  | 'idea'
  | 'task'
  | 'project'
  | 'conversation'
  | 'link'
  | 'memory'
  | 'document';

export type NodeStatus = 'active' | 'archived' | 'pinned';
export type EdgeKind = 'link' | 'derives' | 'tagged' | 'mentions' | 'semantic';

export interface AtlasNode {
  id: string;
  kind: NodeKind;
  title: string;
  body: string;
  x: number;
  y: number;
  weight: number;
  status: NodeStatus;
  tags: string[];
  projectId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface AtlasEdge {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
  strength: number;
  createdAt: number;
}

export function makeId(prefix: 'n' | 'e' = 'n'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}
