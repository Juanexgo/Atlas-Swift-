/**
 * Atlas core domain schemas.
 *
 * Zod schemas are the source of truth — TS types are inferred, runtime
 * validation is free. Used to validate Yjs writes, API responses, user input.
 */
import { z } from 'zod';

export const NodeKindSchema = z.enum([
  'note',
  'idea',
  'task',
  'project',
  'conversation',
  'link',
  'memory',
  'document',
]);
export type NodeKind = z.infer<typeof NodeKindSchema>;

/** Stable mapping of kind → accent token name. Kept here (not in design-tokens)
 * because it is a *semantic* mapping, not a visual primitive. */
export const NODE_KIND_ACCENT: Record<NodeKind, string> = {
  note: 'aurora',
  idea: 'solar',
  task: 'forest',
  project: 'indigo',
  conversation: 'plasma',
  link: 'coral',
  memory: 'nebula',
  document: 'aurora',
};

export const NodeStatusSchema = z.enum(['active', 'archived', 'pinned']);
export type NodeStatus = z.infer<typeof NodeStatusSchema>;

/**
 * A node's stored shape. Position is the layout's last resting state —
 * the live force simulation reads/writes through this same field.
 */
export const NodeSchema = z.object({
  id: z.string().min(1),
  kind: NodeKindSchema,
  title: z.string(),
  body: z.string().default(''),
  /** Layout position in world space. */
  x: z.number(),
  y: z.number(),
  /** Visual weight 0..1 — drives radius, glow, priority. */
  weight: z.number().min(0).max(1).default(0.5),
  status: NodeStatusSchema.default('active'),
  tags: z.array(z.string()).default([]),
  projectId: z.string().nullable().default(null),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type AtlasNode = z.infer<typeof NodeSchema>;

export const EdgeKindSchema = z.enum(['link', 'derives', 'tagged', 'mentions', 'semantic']);
export type EdgeKind = z.infer<typeof EdgeKindSchema>;

export const EdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string(),
  target: z.string(),
  kind: EdgeKindSchema.default('link'),
  /** Connection strength 0..1 — drives line opacity + force attraction. */
  strength: z.number().min(0).max(1).default(0.5),
  createdAt: z.number().int(),
});
export type AtlasEdge = z.infer<typeof EdgeSchema>;

export const GraphSnapshotSchema = z.object({
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema),
});
export type GraphSnapshot = z.infer<typeof GraphSnapshotSchema>;

/** Stable ID helper — not a UUID, just a short readable handle. */
export function makeId(prefix: 'n' | 'e' = 'n'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}
