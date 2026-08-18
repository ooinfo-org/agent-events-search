#!/usr/bin/env tsx
/**
 * Cria a lista "artistas" e seus campos no Ooinfo.
 * Execute: npm run table:artistas
 */
import 'dotenv/config';
import { login } from '../src/api/client.js';
import { ensureList, ensureFields } from './lib/table-utils.js';
import { ARTISTAS_LIST_SLUG } from '../src/api/mapping.js';

async function main() {
  console.log('=== create-table: artistas ===\n');

  await login();
  console.log('✓ Login OK\n');

  const listId = await ensureList(ARTISTAS_LIST_SLUG, {
    name: 'Artistas',
    description: 'Artistas e performers de eventos culturais',
  });

  console.log('\n→ Verificando campos...');
  await ensureFields(listId, [
    { key: 'nome_artistico', name: 'Nome Artístico', type: 'TEXT', isRequired: true  },
    { key: 'tipo',           name: 'Tipo',           type: 'TAGS', isRequired: false },
  ]);

  console.log('\n✅ Estrutura pronta!');
  console.log('\nAdicione ao .env:');
  console.log(`OOINFO_LIST_ID_ARTISTAS=${listId}`);
}

main().catch((err) => {
  console.error('\n✗ Erro:', err instanceof Error ? err.message : err);
  process.exit(1);
});
