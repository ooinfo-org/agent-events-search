/**
 * Scraping de plataformas conhecidas antes de rodar o agente LLM.
 * Fornece URLs reais para evitar que o modelo invente IDs numéricos.
 *
 * Cada plataforma é um objeto Platform com name + fetch().
 * Adicionar nova plataforma: implemente a interface e adicione a PLATFORMS[].
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const FETCH_TIMEOUT_MS = 10_000;
const MAX_HTML_BYTES = 600 * 1024;

export interface PlatformEvent {
  nome: string;
  url: string;
  data?: string;    // YYYY-MM-DD quando disponível
  imagem?: string;  // URL da imagem quando disponível
}

interface Platform {
  name: string;
  fetch(cidade: string, uf: string): Promise<PlatformEvent[]>;
}

// ── HTTP helper ─────────────────────────────────────────────────────────────

async function fetchHtml(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const reader = res.body?.getReader();
    if (!reader) return await res.text();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
      if (total >= MAX_HTML_BYTES) { try { await reader.cancel(); } catch { /**/ } break; }
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(
      Buffer.concat(chunks.map((c) => Buffer.from(c))),
    );
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── Helpers de slug ──────────────────────────────────────────────────────────

function slugify(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-');
}

// HTML tem JSON double-escaped (\\\"key\\\":\\\"value\\\")
// Esta função extrai valor de campo escaped próximo a um índice
function extractEscapedField(html: string, around: number, field: string, windowSize = 2000): string | null {
  const start = Math.max(0, around - windowSize);
  const end = Math.min(html.length, around + windowSize);
  const ctx = html.slice(start, end);
  // Formato: \"field\":\"value\" (com backslash real antes das aspas)
  const re = new RegExp(`\\\\"${field}\\\\":\\\\"([^\\\\"]+)\\\\"`, 'i');
  return ctx.match(re)?.[1] ?? null;
}

function extractEscapedUrl(html: string, around: number, urlPattern: RegExp, windowSize = 1000): string | null {
  const ctx = html.slice(Math.max(0, around - windowSize), Math.min(html.length, around + 200));
  return ctx.match(urlPattern)?.[1] ?? null;
}

// ── Sympla ───────────────────────────────────────────────────────────────────
// Página: sympla.com.br/eventos/cidade-uf
// URLs estão em JSON embutido (double-escaped): \"url\":\"https://...evento/slug/ID\"

const SYMPLA_EVENT_URL_RE = /https?:\/\/(?:www\.)?sympla\.com\.br\/evento\/([a-z0-9\-]+)\/(\d+)/gi;

// Estrutura do JSON (double-escaped): url → start_date_formats → organizer{name} → end_date_formats → name (evento)
// "name" do EVENTO vem depois de "end_date_formats", não confundir com "organizer.name"
const SYMPLA_END_DATE_RE = /\\"end_date_formats\\":\{[^}]+\},\\"name\\":\\"([^\\"]+)\\"/;
const SYMPLA_START_DATE_RE = /\\"start_date\\":\\"(\d{4}-\d{2}-\d{2})/;
const SYMPLA_IMAGE_LG_RE = /\\"lg\\":\\"(https:\/\/images\.sympla\.com\.br[^\\"]+)\\"/;

const symplaScraper: Platform = {
  name: 'Sympla',
  async fetch(cidade, uf) {
    const slug = `${slugify(cidade)}-${uf.toLowerCase()}`;
    const html = await fetchHtml(`https://www.sympla.com.br/eventos/${slug}`);
    if (!html) return [];

    const seen = new Set<string>();
    const events: PlatformEvent[] = [];

    SYMPLA_EVENT_URL_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = SYMPLA_EVENT_URL_RE.exec(html)) !== null) {
      const url = `https://www.sympla.com.br/evento/${m[1]}/${m[2]}`;
      if (seen.has(url)) continue;
      seen.add(url);

      // Janela APÓS a URL (nome e datas vêm depois no JSON)
      const after = html.slice(m.index, Math.min(html.length, m.index + 1200));
      // Janela ANTES da URL (imagem vem antes)
      const before = html.slice(Math.max(0, m.index - 600), m.index);

      const nome = after.match(SYMPLA_END_DATE_RE)?.[1] ?? m[1].replace(/-/g, ' ');
      const dataRaw = after.match(SYMPLA_START_DATE_RE)?.[1];
      const imagem = before.match(SYMPLA_IMAGE_LG_RE)?.[1];

      events.push({
        nome,
        url,
        ...(dataRaw ? { data: dataRaw } : {}),
        ...(imagem ? { imagem } : {}),
      });
    }

    return events;
  },
};

// ── PLATAFORMAS ATIVAS ───────────────────────────────────────────────────────
// Para adicionar nova plataforma: implemente Platform e adicione aqui.
// Plataformas CSR (Ingresso.com, GuicheWeb, Eventbrite) não têm HTML estático
// com links de eventos — cobertas pelo web_search_preview do agente.

const PLATFORMS: Platform[] = [
  symplaScraper,
];

// ── API pública ───────────────────────────────────────────────────────────────

export async function fetchSymplaEvents(cidade: string, uf: string): Promise<PlatformEvent[]> {
  return symplaScraper.fetch(cidade, uf);
}

export async function buildPlatformContext(cidade: string, uf: string): Promise<string> {
  const results = await Promise.allSettled(
    PLATFORMS.map((p) => p.fetch(cidade, uf).catch(() => [] as PlatformEvent[])),
  );

  const sections: string[] = [];

  for (let i = 0; i < PLATFORMS.length; i++) {
    const p = PLATFORMS[i];
    const r = results[i];
    const events: PlatformEvent[] = r.status === 'fulfilled' ? r.value : [];
    if (events.length === 0) continue;

    const lines = events.map((e: PlatformEvent) => {
      const parts = [`  "${e.nome}" → ${e.url}`];
      if (e.data) parts.push(`[data: ${e.data}]`);
      return parts.join(' ');
    });

    sections.push(
      `\n\n--- REFERÊNCIA ${p.name.toUpperCase()} ${cidade.toUpperCase()} (${events.length} eventos — URLs reais, use literalmente) ---`,
      ...lines,
      `--- FIM ${p.name.toUpperCase()} ---`,
    );
  }

  return sections.join('\n');
}
