/**
 * AI domain types. Embeddings live in plain Float32Array to stay
 * efficient; the typed wrappers carry dimension + provider metadata.
 */

export interface Embedding {
  /** L2-normalized vector. Cosine === dot for normalized vectors. */
  vector: Float32Array;
  dim: number;
  /** Provider that generated this embedding. Used for cache invalidation. */
  provider: string;
  /** Version of the provider's model. */
  version: string;
}

export interface EmbedRequest {
  /** Caller-defined id for cache lookups. */
  id: string;
  text: string;
}

export interface EmbeddingProvider {
  readonly name: string;
  readonly version: string;
  readonly dim: number;
  embed(texts: string[]): Promise<Embedding[]>;
}

export interface CompletionProvider {
  readonly name: string;
  readonly version: string;
  complete(prompt: string, opts?: CompletionOptions): Promise<string>;
}

export interface CompletionOptions {
  maxTokens?: number;
  temperature?: number;
  /** Optional system message. */
  system?: string;
}

export interface SemanticHit {
  id: string;
  score: number;
}

export interface ClusterAssignment {
  /** node id → cluster index */
  byNode: Map<string, number>;
  /** cluster index → ids in cluster (deterministic order). */
  byCluster: string[][];
  /** Centroid per cluster, same dim as inputs. */
  centroids: Float32Array[];
}

export interface RelationshipSuggestion {
  source: string;
  target: string;
  /** Cosine similarity in [0,1]. */
  score: number;
}
