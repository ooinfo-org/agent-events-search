import type { SearchProvider, SearchResult } from './types.js';

const BRAVE_URL = 'https://api.search.brave.com/res/v1/web/search';
const TIMEOUT_MS = 10_000;

export function createBraveProvider(): SearchProvider {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) throw new Error('BRAVE_API_KEY ausente no .env');

  return {
    name: 'brave',
    async search(query: string, maxResults = 5): Promise<SearchResult[]> {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      try {
        const url = new URL(BRAVE_URL);
        url.searchParams.set('q', query);
        url.searchParams.set('count', String(maxResults));
        url.searchParams.set('country', 'BR');
        url.searchParams.set('extra_snippets', '1');

        const res = await fetch(url.toString(), {
          signal: ctrl.signal,
          headers: {
            'X-Subscription-Token': apiKey,
            Accept: 'application/json',
          },
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new Error(`Brave HTTP ${res.status}: ${body.slice(0, 200)}`);
        }
        const data = (await res.json()) as {
          web?: { results: Array<{ title: string; url: string; description: string; extra_snippets?: string[] }> };
        };
        return (data.web?.results ?? []).map((r) => {
          const extras = (r.extra_snippets ?? []).join(' ').trim();
          return {
            title: r.title ?? '',
            url: r.url ?? '',
            snippet: extras ? `${r.description ?? ''} ${extras}` : (r.description ?? ''),
          };
        });
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
