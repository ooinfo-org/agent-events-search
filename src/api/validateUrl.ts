const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const TIMEOUT_MS = 8_000;

async function tryRequest(url: string, method: 'HEAD' | 'GET'): Promise<number | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    return res.status;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// True se URL responde 200-399. Tenta HEAD primeiro; se 405/403/501, fallback GET.
export async function isUrlAlive(url: string): Promise<boolean> {
  try {
    new URL(url);
  } catch {
    return false;
  }
  const headStatus = await tryRequest(url, 'HEAD');
  if (headStatus !== null && headStatus >= 200 && headStatus < 400) return true;
  // Fallback: alguns sites bloqueiam HEAD.
  if (headStatus === null || [403, 405, 501].includes(headStatus)) {
    const getStatus = await tryRequest(url, 'GET');
    return getStatus !== null && getStatus >= 200 && getStatus < 400;
  }
  return false;
}

export async function checkAliveConcurrent<T>(
  items: T[],
  getUrl: (t: T) => string,
  concurrency = 5,
): Promise<boolean[]> {
  const results: boolean[] = new Array(items.length).fill(false);
  let cursor = 0;

  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      results[idx] = await isUrlAlive(getUrl(items[idx]));
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
