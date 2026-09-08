#!/usr/bin/env tsx
/**
 * Passo 2: popula (ou atualiza) os buckets na lista do Ooinfo.
 * Requer OOINFO_LIST_ID_BUCKETS no .env (obtido após table:buckets ou table:all).
 * Execute: npm run buckets:seed
 *
 * Idempotente — faz upsert por label, sem duplicar.
 * Edite BUCKETS em scripts/lib/buckets-data.ts e rode novamente para sincronizar.
 */
import 'dotenv/config';
import { login, apiRequest } from '../src/api/client.js';
import { BUCKET_LIST_SLUG, BUCKETS } from './lib/buckets-data.js';
import { resolveListId as resolveListIdShared } from './lib/table-utils.js';

interface Item {
  id: string;
  values: Record<string, unknown>;
}

interface ItemsResponse {
  data: Item[];
  pagination?: { hasMore?: boolean };
}

async function resolveListId(): Promise<string> {
  return resolveListIdShared({
    envVar: 'OOINFO_LIST_ID_BUCKETS',
    slugCandidates: [BUCKET_LIST_SLUG],
    errorHint: 'Lista de buckets não encontrada. Rode `npm run table:buckets` primeiro.',
  });
}

async function upsertBuckets(listId: string): Promise<void> {
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

  const existingByLabel = new Map<string, string>();
  for (const item of all) {
    const label = item.values['label'] as string | undefined;
    if (label) existingByLabel.set(label, item.id);
  }

  let created = 0;
  let updated = 0;

  for (const bucket of BUCKETS) {
    const values = {
      label: bucket.label,
      categorias: bucket.categorias,
      hints: bucket.hints,
    };

    const existingId = existingByLabel.get(bucket.label);
    if (existingId) {
      await apiRequest(`/api/lists/${listId}/items/${existingId}`, {
        method: 'PATCH',
        body: { values },
      });
      console.log(`  ↻ Atualizado: ${bucket.label}`);
      updated++;
    } else {
      await apiRequest<{ id: string }>(`/api/lists/${listId}/items`, {
        method: 'POST',
        body: { values },
      });
      console.log(`  + Criado:    ${bucket.label}`);
      created++;
    }
  }

  console.log(`\n  ${created} criados, ${updated} atualizados`);
}

async function main() {
  console.log('=== seed-buckets ===\n');

  await login();
  console.log('✓ Login OK\n');

  const listId = await resolveListId();
  console.log(`→ Lista: ${listId}\n`);

  console.log('→ Sincronizando buckets...');
  await upsertBuckets(listId);

  console.log('\n✅ Concluído!');
}

main().catch((err) => {
  console.error('\n✗ Erro:', err instanceof Error ? err.message : err);
  process.exit(1);
});
