import { apiRequest, LIST_ID_EVENTOS } from './client.js';
import type { MappedEvento } from './mapEvento.js';

interface ExistingItem {
  id: string;
  values: Record<string, unknown>;
}

interface ItemsResponse<T> {
  data: T[];
  pagination?: { hasMore?: boolean; nextCursor?: string | null };
}

const existingCache = new Map<string, ExistingItem[]>();

function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function dedupKey(nome: string, cityId: string): string {
  return `${normalizeText(nome)}|${cityId}`;
}

async function fetchAllEventosForCity(cityId: string): Promise<ExistingItem[]> {
  if (existingCache.has(cityId)) return existingCache.get(cityId)!;
  const all: ExistingItem[] = [];
  let page = 1;
  while (true) {
    const res = await apiRequest<ItemsResponse<ExistingItem>>(
      `/api/lists/${LIST_ID_EVENTOS}/items/optimized`,
      { auth: false, query: { page, limit: 200 } },
    );
    for (const it of res.data) {
      const cidade = it.values['cidade_principal'] as { id?: string } | null | undefined;
      if (cidade?.id === cityId) all.push(it);
    }
    if (!res.pagination?.hasMore) break;
    page += 1;
    if (page > 50) break;
  }
  existingCache.set(cityId, all);
  return all;
}

function computeDiff(existing: Record<string, unknown>, incoming: Record<string, unknown>): Record<string, unknown> {
  const diff: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(incoming)) {
    const cur = existing[k];
    if (JSON.stringify(cur) !== JSON.stringify(v)) diff[k] = v;
  }
  return diff;
}

export type UpsertResult =
  | { action: 'created'; id: string; nome: string }
  | { action: 'updated'; id: string; nome: string; diffKeys: string[] }
  | { action: 'unchanged'; id: string; nome: string }
  | { action: 'dry-run-create'; nome: string }
  | { action: 'dry-run-update'; id: string; nome: string; diffKeys: string[] }
  | { action: 'dry-run-unchanged'; id: string; nome: string };

export async function upsertEvento(
  mapped: MappedEvento,
  opts: { dryRun: boolean },
): Promise<UpsertResult> {
  const nome = mapped.values['nome_do_evento'] as string;
  const cityId = mapped.cityId;

  const existing = await fetchAllEventosForCity(cityId);
  const key = dedupKey(nome, cityId);
  const match = existing.find(
    (it) => dedupKey(it.values['nome_do_evento'] as string, cityId) === key,
  );

  if (!match) {
    if (opts.dryRun) return { action: 'dry-run-create', nome };
    const created = await apiRequest<{ id: string }>(
      `/api/lists/${LIST_ID_EVENTOS}/items`,
      { method: 'POST', body: { values: mapped.values } },
    );
    return { action: 'created', id: created.id, nome };
  }

  const diff = computeDiff(match.values, mapped.values);
  const diffKeys = Object.keys(diff).filter((k) => k !== 'ultima_verificacao');

  if (diffKeys.length === 0) {
    return opts.dryRun
      ? { action: 'dry-run-unchanged', id: match.id, nome }
      : { action: 'unchanged', id: match.id, nome };
  }

  if (opts.dryRun) return { action: 'dry-run-update', id: match.id, nome, diffKeys };

  await apiRequest(
    `/api/lists/${LIST_ID_EVENTOS}/items/${match.id}`,
    { method: 'PATCH', body: { values: diff } },
  );
  return { action: 'updated', id: match.id, nome, diffKeys };
}
