/**
 * AI summaries for nodes. Wraps a CompletionProvider with a Atlas-flavored
 * prompt and a small bit of context-gathering.
 */
import type { AtlasNode } from '@atlas/types';
import type { CompletionProvider } from './types';

interface SummaryContext {
  node: AtlasNode;
  /** Titles of related nodes — anchors the summary in the graph. */
  related: string[];
}

const SYSTEM_PROMPT = `You are Atlas, a spatial knowledge assistant. You summarize a node in the
user's personal knowledge graph in one short, useful paragraph (≤80 words).
You are factual, not flowery. You connect the node to its neighbors when
it sharpens the meaning. You never invent facts not present in the
provided content.`;

export async function summarizeNode(
  provider: CompletionProvider,
  ctx: SummaryContext,
): Promise<string> {
  const related = ctx.related.length > 0 ? `\n\nRelated nodes:\n- ${ctx.related.join('\n- ')}` : '';
  const prompt = `Node kind: ${ctx.node.kind}
Title: ${ctx.node.title}
Body: ${ctx.node.body || '(empty)'}
Tags: ${ctx.node.tags.join(', ') || '(none)'}${related}

Write the summary now.`;
  const text = await provider.complete(prompt, {
    system: SYSTEM_PROMPT,
    maxTokens: 180,
    temperature: 0.3,
  });
  return text.trim();
}

/**
 * Label a cluster from member titles. Used by AI relationship mapping
 * to give clusters a human-readable name.
 */
export async function labelCluster(
  provider: CompletionProvider,
  memberTitles: string[],
): Promise<string> {
  const titles = memberTitles.slice(0, 12).map((t) => `- ${t}`).join('\n');
  const prompt = `These are the titles of nodes that cluster together in a personal knowledge graph:

${titles}

Give this cluster a short label — 2–4 words, lowercase, no quotes, no period.`;
  const text = await provider.complete(prompt, {
    maxTokens: 24,
    temperature: 0.2,
    system: 'You produce short, precise topic labels. Lowercase. 2–4 words.',
  });
  return text.trim().replace(/^["'`]|["'`]$/g, '').toLowerCase().slice(0, 40);
}
