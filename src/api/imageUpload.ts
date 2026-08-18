import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { apiRequest, BASE_URL } from './client.js';

const MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 15_000;
const THUMB_WIDTH = 800;
const THUMB_QUALITY = 80;

interface UploadResponse {
  url?: string;
  filename?: string;
  path?: string;
  data?: { url?: string; filename?: string };
}

async function downloadImage(url: string): Promise<Buffer> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`download ${res.status}`);
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.startsWith('image/')) throw new Error(`content-type inválido: ${ct}`);
    const len = res.headers.get('content-length');
    if (len && Number(len) > MAX_DOWNLOAD_BYTES) throw new Error(`imagem >10MB (${len})`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_DOWNLOAD_BYTES) throw new Error(`buffer >10MB (${buf.length})`);
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

async function resizeToThumb(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: THUMB_QUALITY, mozjpeg: true })
    .toBuffer();
}

function extractUrlFromResponse(res: UploadResponse): string | null {
  const candidates = [
    res.url,
    res.data?.url,
    res.path,
    res.filename && `/api/uploads/images/${res.filename}`,
    res.data?.filename && `/api/uploads/images/${res.data.filename}`,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c;
  }
  return null;
}

export async function processarECoverImagem(sourceUrl: string): Promise<string | null> {
  try {
    const original = await downloadImage(sourceUrl);
    const thumb = await resizeToThumb(original);

    const hash = createHash('sha1').update(thumb).digest('hex').slice(0, 8);
    const filename = `evento-${hash}.jpg`;

    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(thumb)], { type: 'image/jpeg' }), filename);

    const res = await apiRequest<UploadResponse>('/api/uploads/image', {
      method: 'POST',
      body: form,
    });

    const url = extractUrlFromResponse(res);
    if (!url) {
      console.error(`    ⚠️  upload OK mas resposta sem URL — payload: ${JSON.stringify(res).slice(0, 200)}`);
      return null;
    }
    return url.startsWith('http') ? url : `${BASE_URL}${url}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`    ⚠️  imagem falhou (${sourceUrl.slice(0, 80)}): ${msg}`);
    return null;
  }
}
