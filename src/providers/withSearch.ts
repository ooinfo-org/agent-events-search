import OpenAI from 'openai';
import type { SearchProvider, SearchResult } from '../search/types.js';
import type { LlmProvider, LlmProviderResult } from './types.js';

const MAX_QUERIES = 3;
const MAX_SNIPPET_CHARS = 400;
const MAX_PAGE_CHARS = 2_500;
const PAGE_FETCH_TIMEOUT = 12_000;
const MAX_PAGES_TO_FETCH = 3;
const MAX_RETRIES = 3;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const DEBUG = process.env.DEBUG === '1';

function extractText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchPageText(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PAGE_FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('html')) return null;
    const html = await res.text();
    const text = extractText(html).slice(0, MAX_PAGE_CHARS);
    return text.length > 100 ? text : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function formatResult(r: SearchResult, pageText: string | null): string {
  const lines = [`[${r.title}](${r.url})`];
  const snippet = (r.content ?? r.snippet ?? '').slice(0, MAX_SNIPPET_CHARS);
  if (snippet) lines.push(`Resumo: ${snippet}`);
  if (pageText) lines.push(`Conteúdo da página:\n${pageText}`);
  return lines.join('\n');
}

function buildAugmentedPrompt(originalPrompt: string, context: string): string {
  return `[RESULTADOS DE BUSCA WEB]\n${context}\n[/RESULTADOS DE BUSCA WEB]\n\nInstruções: Use APENAS os resultados acima como fonte. Não invente eventos ausentes.\n\n${originalPrompt}`;
}

async function chatWithRetry(
  client: OpenAI,
  params: Parameters<OpenAI['chat']['completions']['create']>[0],
): Promise<OpenAI.Chat.ChatCompletion> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await client.chat.completions.create(params) as OpenAI.Chat.ChatCompletion;
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      const msg = String(err);
      const isNoCredits = msg.includes('no credits') || msg.includes('insufficient_quota');
      if (status === 429 && !isNoCredits && attempt < MAX_RETRIES - 1) {
        const match = msg.match(/try again in ([\d.]+)s/);
        const waitMs = match ? Math.ceil(parseFloat(match[1]) * 1000) + 500 : 10_000;
        console.error(`    [withSearch] 429 — aguardando ${waitMs}ms...`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error('chatWithRetry: max retries exceeded');
}

export interface LlmConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  headers?: Record<string, string>;
}

export function createWithSearchProvider(searchProvider: SearchProvider, baseName: string, llmConfig: LlmConfig): LlmProvider {
  const { apiKey, baseURL, model, headers } = llmConfig;
  const client = new OpenAI({ apiKey, baseURL, defaultHeaders: headers });
  // Playwright abre contextos de browser — serializar tudo para não travar o PC
  const defaultConcurrency = searchProvider.visitPage ? 1 : 4;
  const concurrency = Number(process.env.WITH_SEARCH_CONCURRENCY ?? defaultConcurrency);

  return {
    name: `${baseName}+${searchProvider.name}`,
    model,
    concurrency,

    async collectBucket(prompt: string, jsonSchema: object, queries: string[] = []): Promise<LlmProviderResult> {
      const activeQueries = queries.slice(0, MAX_QUERIES);
      if (activeQueries.length === 0) {
        // sem busca → chama LLM direto (fallback)
        const res = await chatWithRetry(client, {
          model, messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_schema', json_schema: { name: 'eventos_bucket', strict: true, schema: jsonSchema as Record<string, unknown> } },
        });
        return { text: res.choices[0]?.message?.content ?? '', toolCalls: 0 };
      }

      // 1. Busca para todas as queries — sequencial se provider usa browser (Playwright)
      const allResults: SearchResult[] = [];
      const sequential = !!searchProvider.visitPage;
      const searchResults: SearchResult[][] = [];
      if (sequential) {
        for (const q of activeQueries) {
          try { searchResults.push(await searchProvider.search(q, 5)); }
          catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`    [search:${searchProvider.name}] erro na query "${q}": ${msg}`);
            searchResults.push([]);
          }
        }
      } else {
        searchResults.push(...await Promise.all(
          activeQueries.map(async (q) => {
            try { return await searchProvider.search(q, 5); }
            catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error(`    [search:${searchProvider.name}] erro na query "${q}": ${msg}`);
              return [] as SearchResult[];
            }
          }),
        ));
      }
      if (DEBUG) {
        for (let i = 0; i < activeQueries.length; i++) {
          console.error(`    [search:${searchProvider.name}] "${activeQueries[i]}": ${searchResults[i].length} resultado(s)`);
        }
      }
      for (const rs of searchResults) allResults.push(...rs);

      // 2. Deduplicar URLs, pegar top N para visitar
      const seenUrls = new Set<string>();
      const uniqueResults: SearchResult[] = [];
      for (const r of allResults) {
        if (r.url && !seenUrls.has(r.url)) {
          seenUrls.add(r.url);
          uniqueResults.push(r);
        }
      }

      // 3. Fetch do conteúdo das top páginas em paralelo
      // Se result já tem conteúdo rico (ex: Tavily raw_content), usa direto — sem fetch extra
      // Se provider tem visitPage (ex: playwright), usa browser para SPA
      // Senão, fetch HTTP simples
      // Playwright: visitar exatamente MAX_PAGES_TO_FETCH (sequencial, sem buffer extra)
      // HTTP: pegar mais e filtrar os que carregarem
      const maxToFetch = sequential ? MAX_PAGES_TO_FETCH : MAX_PAGES_TO_FETCH + 5;
      const topResults = uniqueResults.slice(0, maxToFetch);
      let pageTexts: (string | null)[];
      if (sequential) {
        // Playwright: sequencial para não abrir múltiplos contextos simultâneos
        pageTexts = [];
        for (const r of topResults) {
          if (r.content && r.content.length > 500) {
            pageTexts.push(r.content.slice(0, MAX_PAGE_CHARS));
          } else {
            try { pageTexts.push(await searchProvider.visitPage!(r.url)); } catch { pageTexts.push(null); }
          }
        }
      } else {
        // HTTP ou conteúdo pré-fetched: paralelo OK
        pageTexts = await Promise.all(
          topResults.map(async (r) => {
            if (r.content && r.content.length > 500) return r.content.slice(0, MAX_PAGE_CHARS);
            return fetchPageText(r.url);
          }),
        );
      }

      // 4. Monta contexto — conteúdo pré-fetched (Tavily) sem limite; HTTP fetch limitado a MAX_PAGES_TO_FETCH
      const contextParts: string[] = [];
      let httpFetches = 0;
      for (let i = 0; i < topResults.length; i++) {
        const hasPreFetched = (topResults[i].content?.length ?? 0) > 500;
        const pageText = pageTexts[i]
          ? (hasPreFetched ? pageTexts[i] : httpFetches < MAX_PAGES_TO_FETCH ? pageTexts[i] : null)
          : null;
        if (pageText && !hasPreFetched) httpFetches++;
        contextParts.push(formatResult(topResults[i], pageText));
      }
      const pagesWithContent = contextParts.filter((_, i) => pageTexts[i]).length;
      if (DEBUG) {
        console.error(`    [search:${searchProvider.name}] ${pagesWithContent} páginas carregadas / ${topResults.length} tentadas`);
        const totalChars = contextParts.join('').length;
        console.error(`    [search:${searchProvider.name}] contexto: ${contextParts.length} resultados, ${totalChars} chars → chamando LLM`);
      }

      const augmented = buildAugmentedPrompt(prompt, contextParts.join('\n\n---\n\n'));

      // 5. Uma única chamada LLM
      const response = await chatWithRetry(client, {
        model,
        messages: [{ role: 'user', content: augmented }],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'eventos_bucket', strict: true, schema: jsonSchema as Record<string, unknown> },
        },
      });

      return { text: response.choices[0]?.message?.content ?? '', toolCalls: activeQueries.length };
    },
  };
}
