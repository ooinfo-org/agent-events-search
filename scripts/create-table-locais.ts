#!/usr/bin/env tsx
/**
 * Cria a lista "locais-culturais" e seus campos no Ooinfo.
 * Execute: npm run table:locais
 */
import 'dotenv/config';
import { login } from '../src/api/client.js';
import { ensureList, ensureFields, resolveCidadesListId } from './lib/table-utils.js';
import { LOCAIS_LIST_SLUG } from '../src/api/mapping.js';

async function main() {
  console.log('=== create-table: locais-culturais ===\n');

  await login();
  console.log('✓ Login OK\n');

  const CIDADES_LIST_ID = await resolveCidadesListId();

  const listId = await ensureList(LOCAIS_LIST_SLUG, {
    name: 'Locais Culturais',
    description: 'Venues, teatros, casas de show e espaços culturais',
  });

  console.log('\n→ Verificando campos...');
  await ensureFields(listId, [
    { key: 'nome',         name: 'Nome',         type: 'TEXT', isRequired: true  },
    { key: 'tipo_de_local',name: 'Tipo de Local', type: 'TAGS', isRequired: false },
    {
      key: 'cidade', name: 'Cidade', type: 'RELATION', isRequired: true,
      configJson: { targetListId: CIDADES_LIST_ID },
    },
    { key: 'endereco', name: 'Endereço', type: 'TEXT', isRequired: false },
    { key: 'bairro',   name: 'Bairro',   type: 'TEXT', isRequired: false },
    { key: 'site',     name: 'Site',     type: 'URL',  isRequired: false },
  ]);

  console.log('\n✅ Estrutura pronta!');
  console.log('\nAdicione ao .env:');
  console.log(`OOINFO_LIST_ID_LOCAIS=${listId}`);
}

main().catch((err) => {
  console.error('\n✗ Erro:', err instanceof Error ? err.message : err);
  process.exit(1);
});
