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
import { ensureList, ensureFields } from './lib/table-utils.js';
import {
  CIDADES_LIST_ID,
  FONTES_LIST_ID,
  LOCAIS_LIST_ID,
  ARTISTAS_LIST_ID,
  ORGS_LIST_ID,
} from '../src/api/mapping.js';

const EVENTOS_SLUG = process.env.OOINFO_EVENTOS_SLUG ?? 'eventos-culturais';

// Env vars têm prioridade sobre IDs hardcoded (útil em tenant novo após table:all)
const fontesId  = process.env.OOINFO_LIST_ID_FONTES    ?? FONTES_LIST_ID;
const locaisId  = process.env.OOINFO_LIST_ID_LOCAIS    ?? LOCAIS_LIST_ID;
const artistasId= process.env.OOINFO_LIST_ID_ARTISTAS  ?? ARTISTAS_LIST_ID;
const orgsId    = process.env.OOINFO_LIST_ID_ORGS      ?? ORGS_LIST_ID;

async function main() {
  console.log('=== create-table: eventos-culturais ===\n');

  await login();
  console.log('✓ Login OK\n');

  const listId = await ensureList(EVENTOS_SLUG, {
    name: 'Eventos Culturais',
    description: 'Agenda de eventos culturais nas capitais brasileiras',
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
      configJson: { targetListId: CIDADES_LIST_ID, labelFieldKey: 'cidade_uf' },
    },
    {
      key: 'local_principal', name: 'Local Principal', type: 'RELATION', isRequired: false,
      configJson: { targetListId: locaisId, labelFieldKey: 'nome' },
    },
    {
      key: 'artistas', name: 'Artistas', type: 'RELATION', isRequired: false,
      configJson: { targetListId: artistasId, labelFieldKey: 'nome_artistico' },
    },
    {
      key: 'organizacoes', name: 'Organizações', type: 'RELATION', isRequired: false,
      configJson: { targetListId: orgsId, labelFieldKey: 'nome' },
    },
    {
      key: 'fontes', name: 'Fontes', type: 'RELATION', isRequired: true,
      configJson: { targetListId: fontesId, labelFieldKey: 'nome' },
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
