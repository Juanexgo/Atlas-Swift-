/**
 * Provider factory. Reads env (server) or process-injected config to pick
 * the active embedding + completion providers. Falls back gracefully.
 *
 *   ATLAS_AI_EMBEDDING  = "deterministic" | "openai"
 *   ATLAS_AI_COMPLETION = "echo" | "anthropic" | "ollama"
 *   ANTHROPIC_API_KEY   = "sk-ant-..."
 *   ATLAS_AI_OLLAMA_MODEL = "llama3.2:3b"      # optional
 *   ATLAS_AI_OLLAMA_URL   = "http://localhost:11434"  # optional
 *
 * Selection rules:
 *   - `anthropic` requires ANTHROPIC_API_KEY; otherwise falls back to echo
 *   - `ollama` always selectable (the daemon presence is checked at call
 *     time, not factory time, so the provider can be hot-swapped without
 *     restarting the server)
 *   - `echo` is the offline placeholder
 *
 * Browser bundles will only see deterministic+echo. Real keys belong on
 * the API server.
 */
import { deterministicProvider } from './providers/deterministic';
import {
  createAnthropicProvider,
  echoCompletionProvider,
} from './providers/anthropic';
import { createOllamaProvider } from './providers/ollama';
import type { CompletionProvider, EmbeddingProvider } from './types';

export interface ProviderConfig {
  embedding?: 'deterministic' | 'openai';
  completion?: 'echo' | 'anthropic' | 'ollama';
  anthropicApiKey?: string;
  anthropicModel?: string;
  ollamaModel?: string;
  ollamaUrl?: string;
}

export function getEmbeddingProvider(cfg: ProviderConfig = {}): EmbeddingProvider {
  const choice = cfg.embedding ?? readEnv('ATLAS_AI_EMBEDDING') ?? 'deterministic';
  if (choice === 'openai') {
    // Placeholder — wire when an OpenAI-shaped endpoint is desired.
    return deterministicProvider;
  }
  return deterministicProvider;
}

export function getCompletionProvider(cfg: ProviderConfig = {}): CompletionProvider {
  const choice = cfg.completion ?? readEnv('ATLAS_AI_COMPLETION') ?? 'echo';

  if (choice === 'anthropic') {
    const key = cfg.anthropicApiKey ?? readEnv('ANTHROPIC_API_KEY');
    if (key) {
      return createAnthropicProvider({
        apiKey: key,
        model: cfg.anthropicModel ?? readEnv('ATLAS_AI_MODEL') ?? undefined,
      });
    }
    // No key — silently fall through to echo so the app doesn't crash.
    return echoCompletionProvider;
  }

  if (choice === 'ollama') {
    return createOllamaProvider({
      baseUrl: cfg.ollamaUrl ?? readEnv('ATLAS_AI_OLLAMA_URL'),
      model: cfg.ollamaModel ?? readEnv('ATLAS_AI_OLLAMA_MODEL'),
    });
  }

  return echoCompletionProvider;
}

function readEnv(name: string): string | undefined {
  if (typeof process === 'undefined' || !process.env) return undefined;
  return process.env[name];
}
