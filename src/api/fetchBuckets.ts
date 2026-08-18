import { apiRequest } from './client.js';

export interface CategoryBucket {
  label: string;
  categorias: string[];
  hints: string[];
}

const BUCKET_LIST_SLUG = 'buckets-de-busca';

let cache: CategoryBucket[] | null = null;

interface Item {
  id: string;
  values: Record<string, unknown>;
}

interface ItemsResponse {
  data: Item[];
  pagination?: { hasMore?: boolean };
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  return [];
}

export async function fetchBuckets(fallback: CategoryBucket[]): Promise<CategoryBucket[]> {
  if (cache) return cache;

  try {
    let listId = process.env.OOINFO_LIST_ID_BUCKETS;
    if (!listId) {
      const list = await apiRequest<{ id: string }>(`/api/lists/slug/${BUCKET_LIST_SLUG}`, { auth: false });
      listId = list.id;
    }

    const all: Item[] = [];
    let page = 1;
    while (true) {
      const res = await apiRequest<ItemsResponse>(
        `/api/lists/${listId}/items/optimized`,
        { auth: false, query: { page, limit: 100 } },
      );
      all.push(...(res.data ?? []));
      if (!res.pagination?.hasMore) break;
      page++;
      if (page > 10) break;
    }

    if (all.length === 0) {
      console.error('  ⚠️  fetchBuckets: lista vazia no Ooinfo, usando fallback hardcoded');
      cache = fallback;
      return cache;
    }

    const parsed = all
      .map((item) => ({
        label: (item.values['label'] as string) ?? '',
        categorias: asStringArray(item.values['categorias']),
        hints: asStringArray(item.values['hints']),
      }))
      .filter((b) => b.label && b.hints.length > 0);

    if (parsed.length === 0) {
      console.error('  ⚠️  fetchBuckets: nenhum bucket válido no Ooinfo, usando fallback hardcoded');
      cache = fallback;
      return cache;
    }

    cache = parsed;
    console.error(`  ✓ ${cache.length} buckets carregados do Ooinfo`);
    return cache;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ⚠️  fetchBuckets falhou (${msg}), usando fallback hardcoded`);
    cache = fallback;
    return cache;
  }
}
