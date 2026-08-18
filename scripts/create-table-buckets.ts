#!/usr/bin/env tsx
/**
 * Cria a lista "buckets-de-busca" e seus campos no Ooinfo.
 * Execute: npm run table:buckets
 */
import 'dotenv/config';
import { login } from '../src/api/client.js';
import { ensureList, ensureFields } from './lib/table-utils.js';
import { BUCKET_LIST_SLUG } from './lib/buckets-data.js';

async function main() {
  console.log('=== create-table: buckets-de-busca ===\n');

  await login();
  console.log('✓ Login OK\n');

  const listId = await ensureList(BUCKET_LIST_SLUG, {
    name: 'Buckets de Busca',
    description: 'Categorias e hints para o agente de coleta de eventos culturais',
  });

  console.log('\n→ Verificando campos...');
  await ensureFields(listId, [
    { key: 'label',      name: 'Label',         type: 'TEXT', isRequired: true  },
    { key: 'categorias', name: 'Categorias',     type: 'TAGS', isRequired: true  },
    { key: 'hints',      name: 'Hints de Busca', type: 'TAGS', isRequired: false },
  ]);

  console.log('\n✅ Estrutura pronta!');
  console.log('\nAdicione ao .env:');
  console.log(`OOINFO_LIST_ID_BUCKETS=${listId}`);
  console.log('\nDepois rode: npm run buckets:seed');
}

main().catch((err) => {
  console.error('\n✗ Erro:', err instanceof Error ? err.message : err);
  process.exit(1);
});
