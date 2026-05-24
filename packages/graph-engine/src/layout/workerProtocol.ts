/**
 * Typed message protocol between main thread and force layout worker.
 *
 * Wire format choices:
 *   - Topology (ids, edges) sent as JSON — small, infrequent, readable.
 *   - Positions sent as Float32Array via transferable buffer — zero-copy,
 *     ~16 bytes/node/tick. A 5000-node graph at 60fps = ~5 MB/s of zero-copy
 *     buffer hops, which is fine.
 *
 * Buffer layout: positions[i*2 + 0] = x, positions[i*2 + 1] = y
 * Index `i` corresponds to `nodeIds[i]` in the last `init` message.
 */

export interface InitMessage {
  type: 'init';
  nodeIds: string[];
  initialPositions: ArrayBuffer; // Float32Array buffer, length = nodeIds.length * 2
  edges: { source: string; target: string; strength: number }[];
  config: ForceConfig;
}

export interface UpdateMessage {
  type: 'update';
  /** Partial structural update: nodes added/removed, edges changed. */
  nodeIds: string[];
  initialPositions: ArrayBuffer;
  edges: { source: string; target: string; strength: number }[];
}

export interface PinMessage {
  type: 'pin';
  /** Pin a node to a position (during drag). null to unpin. */
  id: string;
  x: number | null;
  y: number | null;
}

export interface ReheatMessage {
  type: 'reheat';
  alpha: number;
}

export interface DisposeMessage {
  type: 'dispose';
}

export type MainToWorker =
  | InitMessage
  | UpdateMessage
  | PinMessage
  | ReheatMessage
  | DisposeMessage;

export interface TickMessage {
  type: 'tick';
  positions: ArrayBuffer; // Float32Array buffer
  alpha: number;
}

export interface SettledMessage {
  type: 'settled';
}

export type WorkerToMain = TickMessage | SettledMessage;

export interface ForceConfig {
  /** Repulsion strength between every pair. Negative = repulsion. */
  charge: number;
  /** Link spring strength multiplier (applied to per-edge strength). */
  linkStrength: number;
  /** Ideal link length. */
  linkDistance: number;
  /** Centering force strength toward (0,0). */
  center: number;
  /** Initial alpha. Higher = more movement. */
  alpha: number;
  /** Stop ticking when alpha falls below this. */
  alphaMin: number;
  /** How quickly alpha decays per tick. */
  alphaDecay: number;
  /** Velocity damping per tick. */
  velocityDecay: number;
}

export const DEFAULT_FORCE_CONFIG: ForceConfig = {
  charge: -180,
  linkStrength: 0.6,
  linkDistance: 70,
  center: 0.04,
  alpha: 1,
  alphaMin: 0.02,
  alphaDecay: 0.018,
  velocityDecay: 0.32,
};
