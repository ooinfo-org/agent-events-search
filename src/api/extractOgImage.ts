const FETCH_TIMEOUT_MS = 12_000;
const MAX_HTML_BYTES = 800 * 1024;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// Patterns em ordem de prioridade — variam attribute order + aspas
const OG_PATTERNS: RegExp[] = [
  /<meta[^>]*property=["']og:image:secure_url["'][^>]*content=["']([^"']+)["']/i,
  /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image:secure_url["']/i,
  /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
  /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
  /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i,
  /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i,
  /<meta[^>]*name=["']twitter:image:src["'][^>]*content=["']([^"']+)["']/i,
  /<meta[^>]*itemprop=["']image["'][^>]*content=["']([^"']+)["']/i,
  /<link[^>]*rel=["']image_src["'][^>]*href=["']([^"']+)["']/i,
];

// JSON-LD: procura "image" em qualquer script type=application/ld+json
const JSONLD_RE = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

// Fallback img: primeira <img src="..."> com hints de cartaz
const IMG_HINT_RE = /<img[^>]*src=["']([^"']+(?:cartaz|banner|capa|cover|poster|hero|highlight)[^"']*)["']/i;

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
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('html') && !ct.includes('xml')) return null;

    const reader = res.body?.getReader();
    if (!reader) return await res.text();

    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
      if (total >= MAX_HTML_BYTES) {
        try { await reader.cancel(); } catch { /* noop */ }
        break;
      }
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#x2F;/gi, '/')
    .replace(/&#47;/g, '/')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function resolveUrl(raw: string, base: string): string | null {
  try {
    return new URL(decodeHtmlEntities(raw.trim()), base).toString();
  } catch {
    return null;
  }
}

function extractFromJsonLd(html: string, base: string): string | null {
  let match: RegExpExecArray | null;
  JSONLD_RE.lastIndex = 0;
  while ((match = JSONLD_RE.exec(html)) !== null) {
    try {
      const raw = match[1].trim();
      const parsed = JSON.parse(raw);
      const found = findImage(parsed);
      if (found) return resolveUrl(found, base);
    } catch { /* skip invalid JSON */ }
  }
  return null;
}

function findImage(obj: unknown): string | null {
  if (!obj) return null;
  if (typeof obj === 'string') return obj;
  if (Array.isArray(obj)) {
    for (const x of obj) {
      const r = findImage(x);
      if (r) return r;
    }
    return null;
  }
  if (typeof obj === 'object') {
    const rec = obj as Record<string, unknown>;
    if ('image' in rec) {
      const img = rec['image'];
      if (typeof img === 'string') return img;
      if (Array.isArray(img) && typeof img[0] === 'string') return img[0];
      if (typeof img === 'object' && img !== null) {
        const url = (img as Record<string, unknown>)['url'];
        if (typeof url === 'string') return url;
      }
    }
    for (const v of Object.values(rec)) {
      const r = findImage(v);
      if (r) return r;
    }
  }
  return null;
}

export async function extractOgImageUrl(pageUrl: string): Promise<string | null> {
  try {
    const html = await fetchHtml(pageUrl);
    if (!html) return null;

    // 1. meta og:image / twitter:image
    for (const pattern of OG_PATTERNS) {
      const m = html.match(pattern);
      if (m && m[1]) {
        const resolved = resolveUrl(m[1], pageUrl);
        if (resolved) return resolved;
      }
    }

    // 2. JSON-LD schema.org
    const fromLd = extractFromJsonLd(html, pageUrl);
    if (fromLd) return fromLd;

    // 3. Fallback: <img> com hint no filename
    const imgMatch = html.match(IMG_HINT_RE);
    if (imgMatch && imgMatch[1]) {
      const resolved = resolveUrl(imgMatch[1], pageUrl);
      if (resolved) return resolved;
    }

    return null;
  } catch {
    return null;
  }
}
