import type { SearchProvider, SearchResult } from './types.js';

// Instâncias públicas SearXNG — tenta em ordem até uma responder
const INSTANCES = [
  'https://searx.be',
  'https://search.bus-hit.me',
  'https://searxng.site',
  'https://paulgo.io',
];

const TIMEOUT_MS = 12_000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

async function tryInstance(base: string, query: string, maxResults: number): Promise<SearchResult[] | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const url = new URL('/search', base);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('categories', 'general');
    url.searchParams.set('language', 'pt');
    url.searchParams.set('pageno', '1');

    const res = await fetch(url.toString(), {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      results?: Array<{ title: string; url: string; content?: string }>;
    };
    const results = (data.results ?? []).slice(0, maxResults).map((r) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      snippet: r.content ?? '',
    }));
    return results;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function createSearXNGProvider(instanceUrl?: string): SearchProvider {
  const instances = instanceUrl ? [instanceUrl, ...INSTANCES] : INSTANCES;

  return {
    name: 'searxng',
    async search(query: string, maxResults = 5): Promise<SearchResult[]> {
      for (const base of instances) {
        const results = await tryInstance(base, query, maxResults);
        if (results && results.length > 0) return results;
      }
      console.error(`    [searxng] todas as instâncias falharam para: "${query}"`);
      return [];
    },
  };
}
