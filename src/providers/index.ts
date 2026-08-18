import type { LlmProvider } from './types.js';
import { createOpenAiProvider } from './openai.js';
import { createOpenRouterProvider } from './openrouter.js';
import { createWithSearchProvider, type LlmConfig } from './withSearch.js';
import { createAgentBrowserProvider } from './agentBrowser.js';
import { getSearchProvider } from '../search/index.js';

export type ProviderName = 'openai' | 'openrouter' | 'agent-browser';

export function getProvider(name?: string): LlmProvider {
  const selected = (name ?? process.env.AGENT_PROVIDER ?? 'openai').toLowerCase() as ProviderName;

  // agent-browser: IA controla o browser via tool calls (search + visit_page)
  if (selected === 'agent-browser') {
    return createAgentBrowserProvider();
  }

  let base: LlmProvider;
  switch (selected) {
    case 'openai':
      base = createOpenAiProvider();
      break;
    case 'openrouter':
      base = createOpenRouterProvider();
      break;
    default:
      throw new Error(`Provider desconhecido: ${selected}. Suportados: openai, openrouter, agent-browser`);
  }

  // Se SEARCH_PROVIDER está definido, envolve o LLM com busca externa independente
  if (process.env.SEARCH_PROVIDER) {
    const search = getSearchProvider(process.env.SEARCH_PROVIDER);
    let llmConfig: LlmConfig;
    if (selected === 'openrouter') {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) throw new Error('OPENROUTER_API_KEY ausente no .env');
      const rawModel = process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o';
      llmConfig = {
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        model: rawModel.replace(/:online$/, ''), // sem :online — busca feita externamente
        headers: {
          'HTTP-Referer': process.env.OPENROUTER_REFERER ?? 'https://ooinfo.org.br',
          'X-Title': process.env.OPENROUTER_TITLE ?? 'base-eventos',
        },
      };
    } else {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error('OPENAI_API_KEY ausente no .env');
      llmConfig = {
        apiKey,
        baseURL: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
        model: base.model,
      };
    }
    return createWithSearchProvider(search, base.name, llmConfig);
  }

  return base;
}

export type { LlmProvider } from './types.js';
