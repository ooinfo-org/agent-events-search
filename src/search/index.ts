import type { SearchProvider } from './types.js';
import { createTavilyProvider } from './tavily.js';
import { createBraveProvider } from './brave.js';
import { createDuckDuckGoProvider } from './duckduckgo.js';
import { createSearXNGProvider } from './searxng.js';
import { createPlaywrightProvider } from './playwright.js';

export type SearchProviderName = 'tavily' | 'brave' | 'duckduckgo' | 'searxng' | 'playwright';

export function getSearchProvider(name?: string): SearchProvider {
  const selected = (name ?? process.env.SEARCH_PROVIDER ?? 'playwright').toLowerCase() as SearchProviderName;
  switch (selected) {
    case 'tavily':
      return createTavilyProvider();
    case 'brave':
      return createBraveProvider();
    case 'duckduckgo':
      return createDuckDuckGoProvider();
    case 'searxng':
      return createSearXNGProvider(process.env.SEARXNG_URL);
    case 'playwright':
      return createPlaywrightProvider();
    default:
      throw new Error(`Search provider desconhecido: ${selected}. Suportados: playwright, searxng, tavily, brave, duckduckgo`);
  }
}

export type { SearchProvider, SearchResult } from './types.js';
