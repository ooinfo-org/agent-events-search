import type { SearchProvider, SearchResult } from './types.js';

const TAVILY_URL = 'https://api.tavily.com/search';
const TIMEOUT_MS = 20_000;

export function createTavilyProvider(): SearchProvider {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error('TAVILY_API_KEY ausente no .env');

  return {
    name: 'tavily',
    async search(query: string, maxResults = 5): Promise<SearchResult[]> {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(TAVILY_URL, {
          method: 'POST',
          signal: ctrl.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: apiKey,
            query,
            max_results: maxResults,
            search_depth: 'advanced',
            include_raw_content: true,
            include_answer: false,
          }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new Error(`Tavily HTTP ${res.status}: ${body.slice(0, 200)}`);
        }
        const data = (await res.json()) as {
          results: Array<{ title: string; url: string; content: string; raw_content?: string }>;
        };
        return (data.results ?? []).map((r) => ({
          title: r.title ?? '',
          url: r.url ?? '',
          snippet: r.content ?? '',
          content: r.raw_content ?? r.content ?? undefined,
        }));
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
