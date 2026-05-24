/**
 * Ollama adapter — local LLM completions, zero cost, fully offline.
 *
 * Ollama exposes an HTTP API on http://localhost:11434 by default.
 * We hit /api/chat with non-streaming responses so the surface stays
 * the same as the other providers.
 *
 * Install:
 *   brew install ollama         # macOS
 *   ollama serve &              # starts the local daemon
 *   ollama pull llama3.2:3b     # ~2GB, runs comfortably on M-series
 *
 * Activate in Atlas (in apps/api/.env):
 *   ATLAS_AI_COMPLETION=ollama
 *   ATLAS_AI_OLLAMA_MODEL=llama3.2:3b
 *   ATLAS_AI_OLLAMA_URL=http://localhost:11434   # optional override
 *
 * Behavior on failure: if Ollama isn't running, the provider throws —
 * the AI service catches and the UI degrades to the offline summary.
 * No silent fallbacks here; we want the user to know.
 */
import type { CompletionOptions, CompletionProvider } from '../types';

interface OllamaConfig {
  /** Base URL of the Ollama daemon. Default http://localhost:11434 */
  baseUrl?: string;
  /** Model name pulled into Ollama. Default llama3.2:3b */
  model?: string;
  /** Optional request timeout in ms — Ollama can stall on big prompts. */
  timeoutMs?: number;
}

interface OllamaChatRequest {
  model: string;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  stream: false;
  options?: {
    temperature?: number;
    num_predict?: number;
  };
}

interface OllamaChatResponse {
  model: string;
  message?: { role: string; content: string };
  done: boolean;
  /** Non-streaming responses include the full message; for streaming each chunk has `message`. */
}

export function createOllamaProvider(cfg: OllamaConfig = {}): CompletionProvider {
  const baseUrl = (cfg.baseUrl ?? 'http://localhost:11434').replace(/\/$/, '');
  const model = cfg.model ?? 'llama3.2:3b';
  // 120s default — local models on consumer hardware can take 30-60s for
  // a few hundred tokens, and even longer on the first call after the
  // daemon loads the model into RAM.
  const timeoutMs = cfg.timeoutMs ?? 120_000;

  return {
    name: 'ollama',
    version: model,
    async complete(prompt: string, opts: CompletionOptions = {}): Promise<string> {
      const body: OllamaChatRequest = {
        model,
        stream: false,
        messages: [
          ...(opts.system ? [{ role: 'system' as const, content: opts.system }] : []),
          { role: 'user', content: prompt },
        ],
        options: {
          temperature: opts.temperature ?? 0.3,
          num_predict: opts.maxTokens ?? 256,
        },
      };

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let res: Response;
      try {
        res = await fetch(`${baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timer);
        const e = err as Error;
        if (e.name === 'AbortError') {
          throw new Error(`Ollama timed out after ${timeoutMs}ms — try a smaller model.`);
        }
        throw new Error(
          `Could not reach Ollama at ${baseUrl}. Is it running? (brew install ollama && ollama serve)`,
        );
      } finally {
        clearTimeout(timer);
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        if (res.status === 404 && text.includes('model')) {
          throw new Error(
            `Ollama: model "${model}" not pulled. Run: ollama pull ${model}`,
          );
        }
        throw new Error(`Ollama ${res.status}: ${text || res.statusText}`);
      }

      const json = (await res.json()) as OllamaChatResponse;
      return json.message?.content?.trim() ?? '';
    },
  };
}
