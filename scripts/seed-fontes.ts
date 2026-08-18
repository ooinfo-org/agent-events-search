#!/usr/bin/env tsx
/**
 * Cria a entrada "Agente OpenAI Web Search" na lista de fontes.
 * Execute: npm run fontes:seed
 *
 * Idempotente — pula se já existir.
 */
import 'dotenv/config';
import { login, apiRequest } from '../src/api/client.js';
import { FONTES_LIST_ID, FONTES_LIST_SLUG } from '../src/api/mapping.js';

const FONTE_LABEL = 'Agente OpenAI Web Search';

interface Item {
  id: string;
  values: Record<string, unknown>;
}

interface ItemsResponse {
  data: Item[];
}

async function main() {
  console.log('=== seed-fontes ===\n');

  await login();
  console.log('✓ Login OK\n');

  const listId = process.env.OOINFO_LIST_ID_FONTES ?? FONTES_LIST_ID;
  console.log(`→ Lista: ${listId} (${FONTES_LIST_SLUG})\n`);

  const res = await apiRequest<ItemsResponse>(
    `/api/lists/${listId}/items/optimized`,
    { auth: false, query: { limit: 200 } },
  );

  const existing = res.data.find((it) => {
    const nome = it.values['nome'] as string | undefined;
    return nome === FONTE_LABEL;
  });

  if (existing) {
    console.log(`✓ Fonte "${FONTE_LABEL}" já existe: ${existing.id}`);
    return;
  }

  const created = await apiRequest<{ id: string }>(
    `/api/lists/${listId}/items`,
    {
      method: 'POST',
      body: {
        values: {
          nome: FONTE_LABEL,
          url_base: 'https://api.openai.com/',
          tipo: ['Automatizada'],
          ativa: true,
          frequencia_de_coleta: ['Diária'],
          observacoes: 'Fonte automática: agente TypeScript usando OpenAI Responses API + web_search_preview.',
        },
      },
    },
  );

  console.log(`✓ Fonte criada: ${created.id}`);
  console.log('\n✅ Concluído!');
}

main().catch((err) => {
  console.error('\n✗ Erro:', err instanceof Error ? err.message : err);
  process.exit(1);
});
