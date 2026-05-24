/**
 * Graph service — converts between Prisma row shapes and the public Atlas
 * shape (AtlasNode/AtlasEdge). Embeddings live as a JSON-encoded Float32
 * array on SQLite; the AI module materializes them back into Float32Array.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  type AtlasEdge,
  type AtlasNode,
  type NodeKind,
  type EdgeKind,
  type NodeStatus,
  makeId,
} from '@atlas/types';
import type { CreateEdgeDto, CreateNodeDto, UpdateNodeDto } from './dto';

@Injectable()
export class GraphService {
  constructor(private readonly prisma: PrismaService) {}

  async listNodes(): Promise<AtlasNode[]> {
    const rows = await this.prisma.node.findMany({ orderBy: { updatedAt: 'desc' } });
    return rows.map(rowToNode);
  }

  async getNode(id: string): Promise<AtlasNode> {
    const row = await this.prisma.node.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Node ${id} not found`);
    return rowToNode(row);
  }

  async createNode(input: CreateNodeDto): Promise<AtlasNode> {
    const now = Date.now();
    const id = input.id ?? makeId('n');
    const row = await this.prisma.node.create({
      data: {
        id,
        kind: input.kind,
        title: input.title,
        body: input.body,
        x: input.x,
        y: input.y,
        weight: input.weight,
        status: input.status,
        tags: JSON.stringify(input.tags),
        projectId: input.projectId,
        createdAt: BigInt(now),
        updatedAt: BigInt(now),
      },
    });
    return rowToNode(row);
  }

  async updateNode(id: string, patch: UpdateNodeDto): Promise<AtlasNode> {
    const data: Record<string, unknown> = { updatedAt: BigInt(Date.now()) };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      data[k] = k === 'tags' ? JSON.stringify(v) : v;
    }
    const row = await this.prisma.node.update({ where: { id }, data });
    return rowToNode(row);
  }

  async deleteNode(id: string): Promise<void> {
    await this.prisma.node.delete({ where: { id } }).catch(() => {
      throw new NotFoundException(`Node ${id} not found`);
    });
  }

  async listEdges(): Promise<AtlasEdge[]> {
    const rows = await this.prisma.edge.findMany();
    return rows.map(rowToEdge);
  }

  async createEdge(input: CreateEdgeDto): Promise<AtlasEdge> {
    const now = Date.now();
    const id = input.id ?? makeId('e');
    const row = await this.prisma.edge.create({
      data: {
        id,
        source: input.source,
        target: input.target,
        kind: input.kind,
        strength: input.strength,
        createdAt: BigInt(now),
      },
    });
    return rowToEdge(row);
  }

  async deleteEdge(id: string): Promise<void> {
    await this.prisma.edge.delete({ where: { id } }).catch(() => {
      throw new NotFoundException(`Edge ${id} not found`);
    });
  }

  /** Used by AI module — fetch the embedding-bearing payload only. */
  async listForEmbedding(): Promise<{ id: string; text: string; embedding: Float32Array | null }[]> {
    const rows = await this.prisma.node.findMany({
      select: { id: true, title: true, body: true, embedding: true, tags: true },
    });
    return rows.map((r) => ({
      id: r.id,
      text: `${r.title}\n${r.body}\n${parseTags(r.tags).join(' ')}`.trim(),
      embedding: r.embedding ? decodeVector(r.embedding) : null,
    }));
  }

  async saveEmbedding(id: string, vector: Float32Array, provider: string): Promise<void> {
    await this.prisma.node.update({
      where: { id },
      data: { embedding: encodeVector(vector), embeddingProvider: provider },
    });
  }
}

/* ── adapters ────────────────────────────────────────────────────────── */

interface NodeRow {
  id: string;
  kind: string;
  title: string;
  body: string;
  x: number;
  y: number;
  weight: number;
  status: string;
  tags: string;
  projectId: string | null;
  createdAt: bigint;
  updatedAt: bigint;
}

interface EdgeRow {
  id: string;
  source: string;
  target: string;
  kind: string;
  strength: number;
  createdAt: bigint;
}

function rowToNode(r: NodeRow): AtlasNode {
  return {
    id: r.id,
    kind: r.kind as NodeKind,
    title: r.title,
    body: r.body,
    x: r.x,
    y: r.y,
    weight: r.weight,
    status: r.status as NodeStatus,
    tags: parseTags(r.tags),
    projectId: r.projectId,
    createdAt: Number(r.createdAt),
    updatedAt: Number(r.updatedAt),
  };
}

function rowToEdge(r: EdgeRow): AtlasEdge {
  return {
    id: r.id,
    source: r.source,
    target: r.target,
    kind: r.kind as EdgeKind,
    strength: r.strength,
    createdAt: Number(r.createdAt),
  };
}

function parseTags(s: string): string[] {
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function encodeVector(v: Float32Array): string {
  // Store as JSON array of numbers — readable, small enough for our sizes.
  return JSON.stringify(Array.from(v));
}

function decodeVector(s: string): Float32Array {
  try {
    const arr = JSON.parse(s);
    if (!Array.isArray(arr)) return new Float32Array(0);
    return new Float32Array(arr);
  } catch {
    return new Float32Array(0);
  }
}
