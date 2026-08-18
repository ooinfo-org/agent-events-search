import { chromium, type Browser } from 'playwright';
import type { SearchProvider, SearchResult } from './types.js';

const SEARCH_TIMEOUT = 15_000;
const PAGE_TIMEOUT = 12_000;
const MAX_PAGE_CHARS = 3_000;

let browser: Browser | null = null;
let exitRegistered = false;

async function getBrowser(): Promise<Browser> {
  if (browser && browser.isConnected()) return browser;
  browser = await chromium.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
      '--lang=pt-BR',
    ],
  });
  if (!exitRegistered) {
    exitRegistered = true;
    process.on('exit', () => { browser?.close().catch(() => {}); });
  }
  return browser;
}

function decodeBingUrl(href: string): string {
  try {
    const u = new URL(href).searchParams.get('u');
    if (!u) return href;
    const b64 = u.startsWith('a1') ? u.slice(2) : u;
    const decoded = Buffer.from(b64, 'base64url').toString('utf-8');
    new URL(decoded);
    return decoded;
  } catch {
    return href;
  }
}

function extractText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Visita uma URL e retorna o conteúdo textual da página (para uso pelo agente)
export async function visitPage(url: string): Promise<string> {
  const b = await getBrowser();
  const ctx = await b.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'pt-BR',
  });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { timeout: PAGE_TIMEOUT, waitUntil: 'domcontentloaded' });
    const html = await page.content();
    return extractText(html).slice(0, MAX_PAGE_CHARS);
  } catch (err) {
    const msg = err instanceof Error ? err.message.split('\n')[0] : String(err);
    return `[erro ao carregar página: ${msg}]`;
  } finally {
    await page.close();
    await ctx.close();
  }
}

async function searchBing(query: string, maxResults: number): Promise<SearchResult[]> {
  const b = await getBrowser();
  const ctx = await b.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'pt-BR',
    viewport: { width: 1366, height: 768 },
  });
  const page = await ctx.newPage();
  try {
    await page.goto(`https://www.bing.com/search?q=${encodeURIComponent(query)}&cc=BR&setlang=pt-BR`, {
      timeout: SEARCH_TIMEOUT,
      waitUntil: 'domcontentloaded',
    });
    await page.waitForSelector('#b_results .b_algo', { timeout: SEARCH_TIMEOUT }).catch(() => {});

    const raw = await page.$$eval('#b_results .b_algo', (els, max) =>
      els.slice(0, max).map((el) => {
        const anchor = el.querySelector('h2 a') as HTMLAnchorElement | null;
        const snippet = el.querySelector('.b_caption p, .b_dList');
        return {
          title: anchor?.textContent?.trim() ?? '',
          url: anchor?.href ?? '',
          snippet: snippet?.textContent?.trim() ?? '',
        };
      }), maxResults);

    return (raw as SearchResult[])
      .filter((r) => r.url && r.title)
      .map((r) => ({ ...r, url: decodeBingUrl(r.url) }));
  } finally {
    await page.close();
    await ctx.close();
  }
}

export function createPlaywrightProvider(): SearchProvider {
  return {
    name: 'playwright',
    async search(query: string, maxResults = 5): Promise<SearchResult[]> {
      return searchBing(query, maxResults);
    },
    // Usa browser headless para páginas SPA (Sympla, Eventbrite, etc.)
    visitPage,
  };
}
