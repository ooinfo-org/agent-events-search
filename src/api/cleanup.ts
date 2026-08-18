import 'dotenv/config';
import { apiRequest, login, LIST_ID_EVENTOS } from './client.js';

interface Item {
  id: string;
  values: Record<string, unknown>;
}

interface ItemsResponse {
  data: Item[];
  pagination?: { hasMore?: boolean };
}

const PATTERNS = [/^DEBUG/i, /^TESTE DEBUG/i, /^\[TESTE\]/i, /^Show Teste Postman$/i];

async function fetchAll(): Promise<Item[]> {
  const all: Item[] = [];
  let page = 1;
  while (true) {
    const res = await apiRequest<ItemsResponse>(
      `/api/lists/${LIST_ID_EVENTOS}/items/optimized`,
      { auth: false, query: { page, limit: 200 } },
    );
    all.push(...res.data);
    if (!res.pagination?.hasMore) break;
    page += 1;
    if (page > 50) break;
  }
  return all;
}

async function main() {
  const doDelete = process.argv.includes('--live');
  await login();
  const items = await fetchAll();
  console.error(`total items: ${items.length}`);

  const targets = items.filter((it) => {
    const nome = (it.values['nome_do_evento'] as string) ?? '';
    return PATTERNS.some((r) => r.test(nome));
  });

  console.error(`\ncandidatos para delete: ${targets.length}`);
  for (const t of targets) {
    console.error(`  ${t.id} | ${t.values['nome_do_evento']}`);
  }

  if (!doDelete) {
    console.error('\n🧪 DRY-RUN — adicione --live para deletar');
    return;
  }

  console.error('\n🔴 deletando...');
  for (const t of targets) {
    try {
      await apiRequest(`/api/lists/${LIST_ID_EVENTOS}/items/${t.id}`, { method: 'DELETE' });
      console.error(`  ✅ ${t.values['nome_do_evento']}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ ${t.values['nome_do_evento']}: ${msg}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
