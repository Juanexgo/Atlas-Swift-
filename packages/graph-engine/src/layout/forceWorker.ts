/**
 * Force layout worker.
 *
 * Runs d3-force off the main thread. Streams positions back to main as
 * transferable ArrayBuffers (zero-copy). Idles when the simulation cools.
 *
 * This file is loaded as a Web Worker. It must not import anything that
 * touches the DOM. d3-force is pure math — safe.
 */
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';
import type {
  MainToWorker,
  WorkerToMain,
  ForceConfig,
} from './workerProtocol';

interface WNode extends SimulationNodeDatum {
  id: string;
}
interface WLink extends SimulationLinkDatum<WNode> {
  source: string | WNode;
  target: string | WNode;
  strength: number;
}

type Ctx = DedicatedWorkerGlobalScope;
const ctx = self as unknown as Ctx;

let sim: Simulation<WNode, WLink> | null = null;
let nodeIds: string[] = [];
let nodes: WNode[] = [];
let pinned: Map<string, { x: number; y: number }> = new Map();
let config: ForceConfig | null = null;
let rafId: number | null = null;
let settledNotified = false;

function post(msg: WorkerToMain, transfer?: Transferable[]): void {
  if (transfer && transfer.length) ctx.postMessage(msg, transfer);
  else ctx.postMessage(msg);
}

function streamPositions(): void {
  if (!sim) return;
  const buffer = new Float32Array(nodes.length * 2);
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]!;
    buffer[i * 2] = n.x ?? 0;
    buffer[i * 2 + 1] = n.y ?? 0;
  }
  post({ type: 'tick', positions: buffer.buffer, alpha: sim.alpha() }, [buffer.buffer]);
}

function tickLoop(): void {
  if (!sim || !config) return;
  // Step once. d3-force's internal tick advances α automatically.
  sim.tick(1);

  // Apply pins: clamp pinned nodes to their pin coordinates.
  if (pinned.size > 0) {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]!;
      const p = pinned.get(n.id);
      if (p) {
        n.x = p.x;
        n.y = p.y;
        n.vx = 0;
        n.vy = 0;
        n.fx = p.x;
        n.fy = p.y;
      } else {
        n.fx = undefined as unknown as null;
        n.fy = undefined as unknown as null;
      }
    }
  }

  streamPositions();

  if (sim.alpha() < config.alphaMin && pinned.size === 0) {
    if (!settledNotified) {
      settledNotified = true;
      post({ type: 'settled' });
    }
    rafId = null;
    return;
  }
  settledNotified = false;
  // Schedule next tick. Worker scope: use setTimeout 0; matches 60fps when
  // budget allows but doesn't busy-loop.
  rafId = setTimeout(tickLoop, 1000 / 60) as unknown as number;
}

function startSim(opts: {
  nodeIds: string[];
  initialPositions: ArrayBuffer;
  edges: { source: string; target: string; strength: number }[];
  config: ForceConfig;
}): void {
  if (sim) sim.stop();
  if (rafId != null) {
    clearTimeout(rafId);
    rafId = null;
  }

  config = opts.config;
  const cfg = opts.config;
  nodeIds = opts.nodeIds;
  const positions = new Float32Array(opts.initialPositions);
  nodes = new Array(nodeIds.length);
  for (let i = 0; i < nodeIds.length; i++) {
    nodes[i] = {
      id: nodeIds[i]!,
      x: positions[i * 2] ?? 0,
      y: positions[i * 2 + 1] ?? 0,
      vx: 0,
      vy: 0,
    };
  }
  const links: WLink[] = opts.edges.map((e) => ({
    source: e.source,
    target: e.target,
    strength: e.strength,
  }));

  sim = forceSimulation<WNode, WLink>(nodes)
    .force('charge', forceManyBody<WNode>().strength(cfg.charge))
    .force(
      'link',
      forceLink<WNode, WLink>(links)
        .id((d: WNode) => d.id)
        .distance(cfg.linkDistance)
        .strength((l: WLink) => Math.max(0.1, l.strength) * cfg.linkStrength),
    )
    .force('center', forceCenter(0, 0).strength(cfg.center))
    .force('collide', forceCollide<WNode>(22))
    .alpha(cfg.alpha)
    .alphaMin(cfg.alphaMin)
    .alphaDecay(cfg.alphaDecay)
    .velocityDecay(cfg.velocityDecay)
    .stop();

  settledNotified = false;
  tickLoop();
}

ctx.addEventListener('message', (e: MessageEvent<MainToWorker>) => {
  const msg = e.data;
  switch (msg.type) {
    case 'init':
    case 'update':
      startSim(msg.type === 'init' ? msg : { ...msg, config: config! });
      break;
    case 'pin':
      if (msg.x == null || msg.y == null) {
        pinned.delete(msg.id);
      } else {
        pinned.set(msg.id, { x: msg.x, y: msg.y });
      }
      if (sim) sim.alpha(Math.max(sim.alpha(), 0.3)).restart();
      if (rafId == null) tickLoop();
      break;
    case 'reheat':
      if (sim) sim.alpha(msg.alpha).restart();
      if (rafId == null) tickLoop();
      break;
    case 'dispose':
      sim?.stop();
      sim = null;
      if (rafId != null) clearTimeout(rafId);
      rafId = null;
      ctx.close();
      break;
  }
});

// Required for TS isolated modules
export {};
