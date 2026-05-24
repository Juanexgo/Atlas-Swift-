/**
 * Anthropic adapter — for completions (summaries, relationship judgment).
 *
 * Anthropic's Messages API doesn't expose embeddings, so we keep
 * embedding work on the deterministic / OpenAI-compatible providers and
 * use Anthropic strictly for prose generation.
 *
 * Activated by setting ATLAS_AI_COMPLETION=anthropic and ANTHROPIC_API_KEY.
 * If either is missing, the factory falls back to an echo provider so
 * code paths still resolve.
 */
import type { CompletionOptions, CompletionProvider } from '../types';

interface AnthropicConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export function createAnthropicProvider(cfg: AnthropicConfig): CompletionProvider {
  const model = cfg.model ?? 'claude-3-5-sonnet-latest';
  const baseUrl = cfg.baseUrl ?? 'https://api.anthropic.com';

  return {
    name: 'anthropic',
    version: model,
    async complete(prompt: string, opts: CompletionOptions = {}): Promise<string> {
      const res = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': cfg.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: opts.maxTokens ?? 512,
          temperature: opts.temperature ?? 0.4,
          system: opts.system,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Anthropic ${res.status}: ${text}`);
      }
      const json = (await res.json()) as { content?: { type: string; text: string }[] };
      const textBlock = (json.content ?? []).find((c) => c.type === 'text');
      return textBlock?.text ?? '';
    },
  };
}

/** Fallback when no API key is configured. Used during local dev. */
export const echoCompletionProvider: CompletionProvider = {
  name: 'echo',
  version: 'v1',
  async complete(prompt: string): Promise<string> {
    // Produce a short, plausible summary from the prompt itself — keeps
    // the UI honest about being in offline mode.
    const m = prompt.match(/title:\s*(.+)/i);
    const title = m?.[1]?.trim().slice(0, 120) ?? 'this node';
    return `Offline summary — set ANTHROPIC_API_KEY for real AI. Captures the gist of "${title}" and its closest neighbors in the graph.`;
  },
};
