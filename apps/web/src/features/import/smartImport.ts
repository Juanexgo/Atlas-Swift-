/**
 * Smart JSON importer.
 *
 * Goal: accept any reasonable JSON shape — an array of objects, or an
 * object containing arrays under common keys (items, nodes, notes,
 * tareas, projects, …) — and map it onto the Atlas graph schema with
 * sensible heuristics. Then derive edges from shared tags, shared
 * projects, and title mentions.
 *
 * If the input already matches Atlas's canonical GraphSnapshot, that
 * path is used directly (no heuristic — exact, lossless).
 *
 * Pipeline:
 *   1. Locate the "items" array in the input.
 *   2. For each item, project to a partial AtlasNode by sniffing
 *      common field names (case-insensitive, multilingual).
 *   3. Derive edges:
 *        - Item references another item by id → link
 *        - Two items share a tag → tagged (strength = jaccard)
 *        - Two items share a projectId → link (strength = 0.6)
 *        - A title appears inside another item's body → mentions
 *   4. Seed positions in concentric rings by kind.
 *
 * Output is validated by GraphSnapshotSchema before returning.
 */
import {
  GraphSnapshotSchema,
  NodeKindSchema,
  type AtlasEdge,
  type AtlasNode,
  type EdgeKind,
  type GraphSnapshot,
  type NodeKind,
  makeId,
} from '@atlas/types';

/* ── field heuristics ─────────────────────────────────────────────────── */

const TITLE_FIELDS = [
  'title', 'name', 'nombre', 'titulo', 'label', 'subject', 'summary', 'heading',
  'displayname', 'display_name', 'caption',
] as const;

const BODY_FIELDS = [
  'body', 'content', 'text', 'description', 'descripcion', 'notes', 'note',
  'detail', 'detalles', 'value', 'markdown', 'md', 'comment',
] as const;

const ID_FIELDS = ['id', 'uuid', '_id', 'key', 'slug', 'identifier'] as const;

const TAGS_FIELDS = ['tags', 'labels', 'etiquetas', 'categories', 'topics', 'keywords'] as const;

const KIND_FIELDS = ['kind', 'type', 'tipo', 'category', 'categoria', 'class'] as const;

const PROJECT_FIELDS = [
  'projectid', 'project', 'proyecto', 'parent', 'parentid', 'parent_id',
  'folder', 'workspace', 'area',
] as const;

const STATUS_FIELDS = ['status', 'state', 'estado'] as const;

const CREATED_FIELDS = [
  'createdat', 'created_at', 'created', 'creado', 'fecha', 'date',
  'timestamp', 'creationdate',
] as const;

const UPDATED_FIELDS = [
  'updatedat', 'updated_at', 'updated', 'modifiedat', 'modified_at',
  'modified', 'modificado', 'last_modified',
] as const;

const WEIGHT_FIELDS = ['weight', 'priority', 'importance', 'prioridad', 'rank'] as const;

const ARRAY_KEYS = [
  'nodes', 'items', 'notes', 'tareas', 'tasks', 'projects', 'records',
  'entries', 'data', 'results', 'rows', 'list', 'collection',
] as const;

/* ── kind inference ───────────────────────────────────────────────────── */

const KIND_SYNONYMS: Record<string, NodeKind> = {
  // direct
  note: 'note', notes: 'note', nota: 'note', notas: 'note', markdown: 'note',
  idea: 'idea', ideas: 'idea', insight: 'idea', insights: 'idea',
  task: 'task', tasks: 'task', tarea: 'task', tareas: 'task', todo: 'task', 'to-do': 'task',
  project: 'project', projects: 'project', proyecto: 'project', proyectos: 'project',
  conversation: 'conversation', chat: 'conversation', conversacion: 'conversation', conversación: 'conversation',
  thread: 'conversation', dm: 'conversation', message: 'conversation',
  link: 'link', url: 'link', bookmark: 'link', favorito: 'link', enlace: 'link',
  memory: 'memory', recuerdo: 'memory', moment: 'memory', highlight: 'memory',
  document: 'document', doc: 'document', documento: 'document', pdf: 'document',
  file: 'document', article: 'document', paper: 'document',
};

function inferKindFromRecord(rec: Record<string, unknown>): NodeKind {
  for (const f of KIND_FIELDS) {
    const v = readField(rec, f);
    if (typeof v === 'string') {
      const k = KIND_SYNONYMS[v.toLowerCase().trim()];
      if (k) return k;
    }
  }
  // Heuristic by presence of certain fields.
  if (readField(rec, 'url') || readField(rec, 'href') || readField(rec, 'link')) return 'link';
  if (readField(rec, 'completed') != null || readField(rec, 'done') != null) return 'task';
  if (readField(rec, 'participants') || readField(rec, 'speaker')) return 'conversation';
  if (readField(rec, 'children') || readField(rec, 'subItems')) return 'project';
  return 'note';
}

/* ── utility readers ──────────────────────────────────────────────────── */

function readField(rec: Record<string, unknown>, name: string): unknown {
  // Case-insensitive lookup.
  const lower = name.toLowerCase();
  for (const k of Object.keys(rec)) {
    if (k.toLowerCase() === lower) return rec[k];
  }
  return undefined;
}

function readFirst(rec: Record<string, unknown>, names: readonly string[]): unknown {
  for (const n of names) {
    const v = readField(rec, n);
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

function toString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

function toTimestamp(v: unknown): number {
  if (typeof v === 'number') {
    // If looks like seconds, scale up.
    if (v > 0 && v < 1e12) return Math.floor(v * 1000);
    return Math.floor(v);
  }
  if (typeof v === 'string') {
    const n = Number(v);
    if (!Number.isNaN(n)) return toTimestamp(n);
    const t = Date.parse(v);
    if (!Number.isNaN(t)) return t;
  }
  return Date.now();
}

function toTags(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.filter((x) => typeof x === 'string' && x.length > 0).map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof v === 'string') {
    return v.split(/[,;|]+/).map((s) => s.trim()).filter(Boolean);
  }
  if (v && typeof v === 'object') {
    // Notion-style: { name, color } objects
    const arr = Object.values(v as Record<string, unknown>);
    return arr
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'name' in item) {
          return String((item as { name: unknown }).name ?? '');
        }
        return '';
      })
      .filter(Boolean);
  }
  return [];
}

function toWeight(v: unknown): number {
  if (typeof v === 'number') {
    if (v >= 0 && v <= 1) return v;
    if (v >= 0 && v <= 100) return v / 100;
    return Math.min(1, Math.max(0, v));
  }
  if (typeof v === 'string') {
    const map: Record<string, number> = {
      low: 0.3, baja: 0.3, normal: 0.5, medium: 0.5, media: 0.5,
      high: 0.75, alta: 0.75, urgent: 0.9, urgente: 0.9, critical: 1, critical1: 1,
    };
    const k = v.toLowerCase().trim();
    if (k in map) return map[k]!;
  }
  return 0.5;
}

/* ── locate items array ───────────────────────────────────────────────── */

function locateItems(input: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(input)) {
    return input.filter((x) => x && typeof x === 'object') as Record<string, unknown>[];
  }
  if (!input || typeof input !== 'object') return null;
  const obj = input as Record<string, unknown>;
  for (const key of ARRAY_KEYS) {
    const v = readField(obj, key);
    if (Array.isArray(v)) {
      return v.filter((x) => x && typeof x === 'object') as Record<string, unknown>[];
    }
  }
  // Last resort: any first-level array.
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') {
      return v.filter((x) => x && typeof x === 'object') as Record<string, unknown>[];
    }
  }
  return null;
}

/* ── main mapper ──────────────────────────────────────────────────────── */

interface MapResult {
  ok: true;
  source: 'canonical' | 'smart';
  snapshot: GraphSnapshot;
  warnings: string[];
}

interface MapFailure {
  ok: false;
  reason: string;
}

export function mapSmart(input: unknown): MapResult | MapFailure {
  // Try canonical first — exact, lossless.
  const canon = GraphSnapshotSchema.safeParse(input);
  if (canon.success) {
    return {
      ok: true,
      source: 'canonical',
      snapshot: canon.data,
      warnings: [],
    };
  }

  const items = locateItems(input);
  if (!items || items.length === 0) {
    return {
      ok: false,
      reason: 'Could not find an array of records in the JSON. Wrap it like `{ "items": [...] }` or paste an array directly.',
    };
  }

  const warnings: string[] = [];
  const nodes: AtlasNode[] = [];
  const seenIds = new Set<string>();
  const oldIdMap = new Map<string, string>(); // original id → atlas id

  for (const rec of items) {
    const rawTitle = toString(readFirst(rec, TITLE_FIELDS));
    if (!rawTitle.trim()) {
      // Skip records with no title — they wouldn't be useful in the graph
      warnings.push(`Skipped record with no title field`);
      continue;
    }
    const kind = inferKindFromRecord(rec);
    const oldId = toString(readFirst(rec, ID_FIELDS));
    const id = makeId('n');
    if (oldId) oldIdMap.set(oldId, id);
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const tags = toTags(readFirst(rec, TAGS_FIELDS));
    const body = toString(readFirst(rec, BODY_FIELDS));
    const projectRaw = toString(readFirst(rec, PROJECT_FIELDS));
    const statusRaw = toString(readFirst(rec, STATUS_FIELDS)).toLowerCase();
    const createdRaw = readFirst(rec, CREATED_FIELDS);
    const updatedRaw = readFirst(rec, UPDATED_FIELDS);
    const weightRaw = readFirst(rec, WEIGHT_FIELDS);

    nodes.push({
      id,
      kind,
      title: rawTitle.trim().slice(0, 200),
      body: body.slice(0, 4000),
      x: 0,
      y: 0,
      weight: toWeight(weightRaw),
      status:
        statusRaw === 'archived' || statusRaw === 'archivado'
          ? 'archived'
          : statusRaw === 'pinned' || statusRaw === 'fijado'
            ? 'pinned'
            : 'active',
      tags,
      projectId: projectRaw || null,
      createdAt: createdRaw != null ? toTimestamp(createdRaw) : Date.now(),
      updatedAt: updatedRaw != null ? toTimestamp(updatedRaw) : Date.now(),
    });
  }

  if (nodes.length === 0) {
    return { ok: false, reason: 'No usable records found (each needs at least a title field).' };
  }

  // Layout: cluster by kind into rings.
  layoutByKind(nodes);

  // Edge derivation.
  const edges: AtlasEdge[] = [];
  const now = Date.now();
  const addEdge = (source: string, target: string, kind: EdgeKind, strength: number) => {
    if (source === target) return;
    edges.push({
      id: makeId('e'),
      source,
      target,
      kind,
      strength: Math.max(0, Math.min(1, strength)),
      createdAt: now,
    });
  };

  // 1. Same projectId.
  const byProject = new Map<string, AtlasNode[]>();
  for (const n of nodes) {
    if (!n.projectId) continue;
    if (!byProject.has(n.projectId)) byProject.set(n.projectId, []);
    byProject.get(n.projectId)!.push(n);
  }
  for (const list of byProject.values()) {
    if (list.length < 2) continue;
    // Prefer a project-kind node as hub if present.
    const hub = list.find((n) => n.kind === 'project') ?? list[0]!;
    for (const n of list) {
      if (n === hub) continue;
      addEdge(hub.id, n.id, 'link', 0.6);
    }
  }

  // 2. Shared tags (jaccard-weighted, only meaningful overlap).
  if (nodes.length <= 1500) {
    // O(n²) — fine at this scale. For larger graphs we'd index by tag.
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i]!;
      if (a.tags.length === 0) continue;
      const aTags = new Set(a.tags.map((t) => t.toLowerCase()));
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j]!;
        if (b.tags.length === 0) continue;
        let common = 0;
        for (const t of b.tags) if (aTags.has(t.toLowerCase())) common++;
        if (common === 0) continue;
        const union = aTags.size + b.tags.length - common;
        const jaccard = common / union;
        if (jaccard >= 0.34) {
          addEdge(a.id, b.id, 'tagged', Math.min(0.9, 0.4 + jaccard * 0.5));
        }
      }
    }
  } else {
    warnings.push(`Skipped tag-derivation (>1500 nodes — would be too dense).`);
  }

  // 3. Title mentions in bodies (fast: simple includes scan).
  if (nodes.length <= 500) {
    const titleToId = new Map<string, string>();
    for (const n of nodes) {
      const t = n.title.toLowerCase().trim();
      if (t.length >= 4) titleToId.set(t, n.id);
    }
    for (const n of nodes) {
      if (!n.body) continue;
      const lower = n.body.toLowerCase();
      for (const [t, otherId] of titleToId) {
        if (otherId === n.id) continue;
        if (lower.includes(t)) {
          addEdge(n.id, otherId, 'mentions', 0.55);
        }
      }
    }
  }

  // 4. Cap edges — past a certain density the graph is unreadable.
  let finalEdges = edges;
  const MAX_EDGES = Math.min(nodes.length * 4, 3000);
  if (finalEdges.length > MAX_EDGES) {
    finalEdges.sort((a, b) => b.strength - a.strength);
    finalEdges = finalEdges.slice(0, MAX_EDGES);
    warnings.push(`Capped edges at ${MAX_EDGES} (had ${edges.length}).`);
  }

  const snapshot: GraphSnapshot = { nodes, edges: finalEdges };
  const validated = GraphSnapshotSchema.safeParse(snapshot);
  if (!validated.success) {
    return {
      ok: false,
      reason: `Mapper output failed validation: ${validated.error.issues[0]?.message}`,
    };
  }

  return {
    ok: true,
    source: 'smart',
    snapshot: validated.data,
    warnings,
  };
}

/* ── layout: concentric rings by kind ─────────────────────────────────── */

const KIND_RING_RADIUS: Record<NodeKind, number> = {
  project: 0,
  note: 220,
  idea: 220,
  task: 360,
  conversation: 360,
  link: 500,
  memory: 500,
  document: 220,
};

function layoutByKind(nodes: AtlasNode[]): void {
  const byKind = new Map<NodeKind, AtlasNode[]>();
  for (const n of nodes) {
    if (!byKind.has(n.kind)) byKind.set(n.kind, []);
    byKind.get(n.kind)!.push(n);
  }
  for (const [kind, list] of byKind) {
    const radius = KIND_RING_RADIUS[kind] ?? 220;
    const count = list.length;
    if (count === 1 && kind === 'project') {
      list[0]!.x = 0;
      list[0]!.y = 0;
      continue;
    }
    for (let i = 0; i < count; i++) {
      const θ = (i / Math.max(1, count)) * Math.PI * 2;
      // Slight jitter so rings don't look like perfect circles
      const r = radius + (((i * 73) % 11) - 5) * 4;
      list[i]!.x = Math.cos(θ) * r;
      list[i]!.y = Math.sin(θ) * r;
    }
  }
  // Validate against zod.
  for (const n of nodes) {
    if (!NodeKindSchema.options.includes(n.kind)) n.kind = 'note';
  }
}
