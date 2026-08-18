#!/usr/bin/env tsx
/**
 * Cria a lista "fontes-de-eventos" e seus campos no Ooinfo.
 * Execute: npm run table:fontes
 */
import 'dotenv/config';
import { login } from '../src/api/client.js';
import { ensureList, ensureFields } from './lib/table-utils.js';
import { FONTES_LIST_SLUG } from '../src/api/mapping.js';

async function main() {
  console.log('=== create-table: fontes-de-eventos ===\n');

  await login();
  console.log('✓ Login OK\n');

  const listId = await ensureList(FONTES_LIST_SLUG, {
    name: 'Fontes de Eventos',
    description: 'Origens e scrapers de eventos culturais',
  });

  console.log('\n→ Verificando campos...');
  await ensureFields(listId, [
    { key: 'nome',                  name: 'Nome',                   type: 'TEXT',     isRequired: true  },
    { key: 'url_base',              name: 'URL Base',               type: 'URL',      isRequired: false },
    { key: 'tipo',                  name: 'Tipo',                   type: 'TAGS',     isRequired: true  },
    { key: 'ativa',                 name: 'Ativa',                  type: 'BOOLEAN',  isRequired: false },
    { key: 'frequencia_de_coleta',  name: 'Frequência de Coleta',   type: 'TAGS',     isRequired: false },
    { key: 'observacoes',           name: 'Observações',            type: 'TEXTAREA', isRequired: false },
  ]);

  console.log('\n✅ Estrutura pronta!');
  console.log('\nAdicione ao .env:');
  console.log(`OOINFO_LIST_ID_FONTES=${listId}`);
  console.log('\nDepois rode: npm run fontes:seed');
}

main().catch((err) => {
  console.error('\n✗ Erro:', err instanceof Error ? err.message : err);
  process.exit(1);
});
