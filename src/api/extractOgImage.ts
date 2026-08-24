const FETCH_TIMEOUT_MS = 12_000;
const HEAD_TIMEOUT_MS = 5_000;
const MAX_HTML_BYTES = 800 * 1024;
const MIN_IMAGE_BYTES = 15_000; // abaixo disso provavelmente é logo/ícone
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

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

const JSONLD_RE = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

const IMG_HINT_RE = /<img[^>]*src=["']([^"']+(?:cartaz|banner|capa|cover|poster|hero|highlight)[^"']*)["']/i;

// Next.js image optimizer: /_next/image?url=<encoded>&w=...
// Extraímos a URL real do parâmetro ?url= e filtramos relativas (logos internos)
const NEXT_IMG_RE = /\/_next\/image\?url=([^&"'\s]+)/gi;

// Padrões de HTML que indicam evento encerrado (genérico — não depende de site)
const ENDED_PATTERNS: RegExp[] = [
  /o evento já encerrou/i,
  /este evento (já )?encerrou/i,
  /evento encerrado/i,
  /this event has (ended|passed)/i,
  /tickets? (are )?no longer (available|on sale)/i,
  /"eventStatus"\s*:\s*"(EventCancelled|EventPostponed)"/i,
  /class=["'][^"']*event[_-]?ended[^"']*["']/i,
];

// Indicadores na URL de que imagem é logo/ícone/thumb — não cartaz
const LOGO_URL_RE = /\/(logo|icon|favicon|brand|sprite|avatar|placeholder|default[-_]img|og[-_]default|share[-_]img)[^/]*\.(png|jpg|gif|svg|webp)/i;
const THUMB_URL_RE = /\/thumb(nail)?s?\//i;
const SMALL_SIZE_RE = /[?&](w|width|h|height|size)=(0*[1-9]\d{0,1})\b/i; // dimensão < 100px

function looksLikeLogo(url: string): boolean {
  return LOGO_URL_RE.test(url) || THUMB_URL_RE.test(url) || SMALL_SIZE_RE.test(url);
}

// ── HTTP helpers ────────────────────────────────────────────────────────────

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

async function probeImageSize(url: string): Promise<number | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), HEAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: 'HEAD', signal: ctrl.signal, redirect: 'follow' });
    const cl = res.headers.get('content-length');
    return cl ? parseInt(cl, 10) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── Parsing helpers ─────────────────────────────────────────────────────────

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

function imageFromObj(obj: Record<string, unknown>): string | null {
  const img = obj['image'];
  if (!img) return null;
  if (typeof img === 'string') return img;
  if (Array.isArray(img)) {
    for (const x of img) {
      if (typeof x === 'string') return x;
      if (x && typeof x === 'object') {
        const u = (x as Record<string, unknown>)['url'];
        if (typeof u === 'string') return u;
      }
    }
  }
  if (typeof img === 'object') {
    const u = (img as Record<string, unknown>)['url'];
    if (typeof u === 'string') return u;
  }
  return null;
}

const EVENT_TYPES = new Set([
  'event', 'musicevent', 'theaterevent', 'sportsevent', 'socialevent',
  'businessevent', 'comedyevent', 'danceevent', 'educationevent',
  'festivalseries', 'foodevent', 'literaryevent', 'visualartsevent',
]);

function normalizeType(t: unknown): string {
  if (typeof t === 'string') return t.toLowerCase().replace(/^schema:/, '');
  if (Array.isArray(t)) return normalizeType(t[0]);
  return '';
}

function findEventImage(obj: unknown): string | null {
  if (!obj || typeof obj !== 'object') return null;
  if (Array.isArray(obj)) {
    for (const x of obj) {
      const r = findEventImage(x);
      if (r) return r;
    }
    return null;
  }
  const rec = obj as Record<string, unknown>;
  if (EVENT_TYPES.has(normalizeType(rec['@type']))) {
    const img = imageFromObj(rec);
    if (img) return img;
  }
  for (const v of Object.values(rec)) {
    if (v && typeof v === 'object') {
      const r = findEventImage(v);
      if (r) return r;
    }
  }
  return null;
}

function findAnyImage(obj: unknown): string | null {
  if (!obj || typeof obj !== 'object') return null;
  if (Array.isArray(obj)) {
    for (const x of obj) { const r = findAnyImage(x); if (r) return r; }
    return null;
  }
  const rec = obj as Record<string, unknown>;
  const img = imageFromObj(rec);
  if (img) return img;
  for (const v of Object.values(rec)) {
    if (v && typeof v === 'object') { const r = findAnyImage(v); if (r) return r; }
  }
  return null;
}

function extractFromNextImages(html: string, base: string): string | null {
  NEXT_IMG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = NEXT_IMG_RE.exec(html)) !== null) {
    try {
      const decoded = decodeURIComponent(m[1]);
      // Apenas URLs absolutas (CDN externo). Caminhos relativos como /logos/ são logos do site.
      if (!decoded.startsWith('http')) continue;
      const resolved = resolveUrl(decoded, base);
      if (resolved && !looksLikeLogo(resolved)) return resolved;
    } catch { /* skip */ }
  }
  return null;
}

function extractFromJsonLd(html: string, base: string): string | null {
  const blocks: unknown[] = [];
  let match: RegExpExecArray | null;
  JSONLD_RE.lastIndex = 0;
  while ((match = JSONLD_RE.exec(html)) !== null) {
    try { blocks.push(JSON.parse(match[1].trim())); } catch { /* skip */ }
  }

  // Passo 1: só blocos @type Event (mais confiável — imagem específica do evento)
  for (const block of blocks) {
    const img = findEventImage(block);
    if (img) { const r = resolveUrl(img, base); if (r) return r; }
  }
  // Passo 2: qualquer image no JSON-LD (fallback)
  for (const block of blocks) {
    const img = findAnyImage(block);
    if (img) { const r = resolveUrl(img, base); if (r) return r; }
  }
  return null;
}

// ── Validação de qualidade ──────────────────────────────────────────────────

async function isAcceptableImage(url: string): Promise<boolean> {
  if (looksLikeLogo(url)) return false;
  const size = await probeImageSize(url);
  if (size !== null && size < MIN_IMAGE_BYTES) return false;
  return true;
}

// ── API pública ────────────────────────────────────────────────────────────

export interface OgImageResult {
  imageUrl: string | null;
  ended: boolean;
}

export async function extractOgImage(pageUrl: string): Promise<OgImageResult> {
  try {
    const html = await fetchHtml(pageUrl);
    if (!html) return { imageUrl: null, ended: false };

    const ended = ENDED_PATTERNS.some((p) => p.test(html));

    // Candidatos em ordem de prioridade:
    // 1. JSON-LD @type:Event.image  ← mais semântico, específico do evento
    // 2. og:image / twitter:image   ← controlado pelo site, pode ser logo
    // 3. <img> com keywords de cartaz no src
    // 4. Next.js /_next/image (CDN externo, sem og:image declarado)
    const candidates: Array<() => string | null> = [
      () => extractFromJsonLd(html, pageUrl),
      ...OG_PATTERNS.map((pattern) => () => {
        const m = html.match(pattern);
        return m?.[1] ? resolveUrl(m[1], pageUrl) : null;
      }),
      () => {
        const m = html.match(IMG_HINT_RE);
        return m?.[1] ? resolveUrl(m[1], pageUrl) : null;
      },
      () => extractFromNextImages(html, pageUrl),
    ];

    for (const fn of candidates) {
      const url = fn();
      if (!url) continue;
      if (await isAcceptableImage(url)) return { imageUrl: url, ended };
    }

    return { imageUrl: null, ended };
  } catch {
    return { imageUrl: null, ended: false };
  }
}

// Compat
export async function extractOgImageUrl(pageUrl: string): Promise<string | null> {
  return (await extractOgImage(pageUrl)).imageUrl;
}
