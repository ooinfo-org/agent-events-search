#!/usr/bin/env tsx
/**
 * Cria a lista "organizacoes-culturais" e seus campos no Ooinfo.
 * Execute: npm run table:orgs
 */
import 'dotenv/config';
import { login } from '../src/api/client.js';
import { ensureList, ensureFields } from './lib/table-utils.js';
import { ORGS_LIST_SLUG } from '../src/api/mapping.js';

async function main() {
  console.log('=== create-table: organizacoes-culturais ===\n');

  await login();
  console.log('✓ Login OK\n');

  const listId = await ensureList(ORGS_LIST_SLUG, {
    name: 'Organizações Culturais',
    description: 'Produtoras e instituições que organizam eventos culturais',
  });

  console.log('\n→ Verificando campos...');
  await ensureFields(listId, [
    { key: 'nome', name: 'Nome', type: 'TEXT', isRequired: true  },
    { key: 'tipo', name: 'Tipo', type: 'TAGS', isRequired: false },
  ]);

  console.log('\n✅ Estrutura pronta!');
  console.log('\nAdicione ao .env:');
  console.log(`OOINFO_LIST_ID_ORGS=${listId}`);
}

main().catch((err) => {
  console.error('\n✗ Erro:', err instanceof Error ? err.message : err);
  process.exit(1);
});
