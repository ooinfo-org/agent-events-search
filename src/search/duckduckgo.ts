import type { SearchProvider, SearchResult } from './types.js';

const DDG_URL = 'https://html.duckduckgo.com/html/';
const TIMEOUT_MS = 12_000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// Extrai bloco de cada resultado
const RESULT_RE = /<div class="result[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
const TITLE_RE = /class="result__a"[^>]*>([^<]+)<\/a>/i;
const URL_RE = /class="result__url"[^>]*>\s*(https?:\/\/[^\s<]+)/i;
const SNIPPET_RE = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i;

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
}

export function createDuckDuckGoProvider(): SearchProvider {
  return {
    name: 'duckduckgo',

    async search(query: string, maxResults = 5): Promise<SearchResult[]> {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      try {
        const body = new URLSearchParams({ q: query, kl: 'br-pt' });
        const res = await fetch(DDG_URL, {
          method: 'POST',
          signal: ctrl.signal,
          headers: {
            'User-Agent': UA,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'text/html',
            'Accept-Language': 'pt-BR,pt;q=0.9',
          },
          body: body.toString(),
        });
        if (!res.ok) throw new Error(`DuckDuckGo HTTP ${res.status}`);
        const html = await res.text();

        const results: SearchResult[] = [];
        let m: RegExpExecArray | null;
        RESULT_RE.lastIndex = 0;
        while ((m = RESULT_RE.exec(html)) !== null && results.length < maxResults) {
          const block = m[1];
          const title = TITLE_RE.exec(block)?.[1];
          const url = URL_RE.exec(block)?.[1];
          const snippet = SNIPPET_RE.exec(block)?.[1];
          if (!title || !url) continue;
          results.push({
            title: stripTags(title),
            url: url.trim(),
            snippet: snippet ? stripTags(snippet) : '',
          });
        }
        return results;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
