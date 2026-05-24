import type { AtlasNode, AtlasEdge, NodeKind } from '@atlas/types';

export type { AtlasNode, AtlasEdge, NodeKind };

/**
 * Renderable, internal node form. The engine receives AtlasNode and projects
 * it into this denser, render-friendly shape. Layout owns x/y/vx/vy.
 */
export interface RenderNode {
  id: string;
  kind: NodeKind;
  title: string;
  body: string;
  tags: string[];
  /** index into the InstancedMesh — assigned on insertion */
  index: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** stable color hex, derived once from kind */
  color: number;
  radius: number;
  weight: number;
}

export interface RenderEdge {
  id: string;
  source: string;
  target: string;
  strength: number;
}

/** GraphInput is the external contract — what callers feed in. */
export interface GraphInput {
  nodes: AtlasNode[];
  edges: AtlasEdge[];
}

/** Camera state — owned by the camera component, exposed via the store. */
export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}
