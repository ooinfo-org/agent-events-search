#!/usr/bin/env tsx
/**
 * Cria a lista "eventos-culturais" e seus campos no Ooinfo.
 * Execute: npm run table:eventos
 *
 * Depende de: fontes, locais, artistas, orgs, cidades (já existirem).
 * Para criar tudo de uma vez: npm run table:all
 */
import 'dotenv/config';
import { login } from '../src/api/client.js';
import { ensureList, ensureFields, resolveCidadesListId, resolveListId } from './lib/table-utils.js';

const EVENTOS_SLUG = process.env.OOINFO_EVENTOS_SLUG ?? 'eventos-culturais';

async function main() {
  console.log('=== create-table: eventos-culturais ===\n');

  await login();
  console.log('✓ Login OK\n');

  const [CIDADES_LIST_ID, fontesId, locaisId, artistasId, orgsId] = await Promise.all([
    resolveCidadesListId(),
    resolveListId({ envVar: 'OOINFO_LIST_ID_FONTES',   slugCandidates: ['fontes-de-eventos'],       errorHint: 'Rode table:fontes primeiro.' }),
    resolveListId({ envVar: 'OOINFO_LIST_ID_LOCAIS',   slugCandidates: ['locais-culturais'],        errorHint: 'Rode table:locais primeiro.' }),
    resolveListId({ envVar: 'OOINFO_LIST_ID_ARTISTAS', slugCandidates: ['artistas'],                errorHint: 'Rode table:artistas primeiro.' }),
    resolveListId({ envVar: 'OOINFO_LIST_ID_ORGS',     slugCandidates: ['organizacoes-culturais'],  errorHint: 'Rode table:orgs primeiro.' }),
  ]);

  const listId = await ensureList(EVENTOS_SLUG, {
    name: 'Eventos Culturais',
    description: 'Agenda de eventos culturais nas capitais brasileiras',
    settingsJson: { displayMode: 'list', itemsPerPage: 10 },
  });

  console.log('\n→ Verificando campos...');
  await ensureFields(listId, [
    { key: 'nome_do_evento',          name: 'Nome do Evento',           type: 'TEXT',     isRequired: true  },
    { key: 'resumo',                  name: 'Resumo',                   type: 'TEXTAREA', isRequired: true  },
    { key: 'descricao_completa',      name: 'Descrição Completa',       type: 'TEXTAREA', isRequired: false },
    { key: 'tipo_de_evento',          name: 'Tipo de Evento',           type: 'TAGS',     isRequired: true  },
    { key: 'categorias',              name: 'Categorias',               type: 'TAGS',     isRequired: true  },
    { key: 'generos_musicais',        name: 'Gêneros Musicais',         type: 'TAGS',     isRequired: false },
    { key: 'formato',                 name: 'Formato',                  type: 'TAGS',     isRequired: true  },
    { key: 'classificacao_indicativa',name: 'Classificação Indicativa', type: 'TAGS',     isRequired: false },
    { key: 'imagem_de_capa',          name: 'Imagem de Capa',           type: 'IMAGE',    isRequired: false },
    { key: 'site_oficial',            name: 'Site Oficial',             type: 'URL',      isRequired: false },
    { key: 'link_geral_de_ingressos', name: 'Link Ingressos',           type: 'URL',      isRequired: false },
    { key: 'gratuito',                name: 'Gratuito',                 type: 'BOOLEAN',  isRequired: true  },
    { key: 'nota',                    name: 'Nota',                     type: 'RATING',   isRequired: false },
    { key: 'status',                  name: 'Status',                   type: 'TAGS',     isRequired: true  },
    { key: 'ultima_verificacao',      name: 'Última Verificação',       type: 'DATE',     isRequired: false },
    {
      key: 'cidade_principal', name: 'Cidade Principal', type: 'RELATION', isRequired: true,
      configJson: { targetListId: CIDADES_LIST_ID },
    },
    {
      key: 'local_principal', name: 'Local Principal', type: 'RELATION', isRequired: false,
      configJson: { targetListId: locaisId },
    },
    {
      key: 'artistas', name: 'Artistas', type: 'RELATION', isRequired: false,
      configJson: { targetListId: artistasId, allowMultiple: true },
    },
    {
      key: 'organizacoes', name: 'Organizações', type: 'RELATION', isRequired: false,
      configJson: { targetListId: orgsId, allowMultiple: true },
    },
    {
      key: 'fontes', name: 'Fontes', type: 'RELATION', isRequired: true,
      configJson: { targetListId: fontesId, allowMultiple: true },
    },
  ]);

  console.log('\n✅ Estrutura pronta!');
  console.log('\nAdicione ao .env:');
  console.log(`OOINFO_LIST_ID_EVENTOS=${listId}`);
}

main().catch((err) => {
  console.error('\n✗ Erro:', err instanceof Error ? err.message : err);
  process.exit(1);
});
