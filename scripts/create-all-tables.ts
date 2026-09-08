#!/usr/bin/env tsx
/**
 * Orquestra a criação de todas as tabelas no Ooinfo na ordem correta de dependência.
 * Execute: npm run table:all
 *
 * Ordem: fontes → locais → artistas → orgs → eventos → buckets
 * (eventos depende de todos os outros como campos RELATION)
 */
import 'dotenv/config';
import { login } from '../src/api/client.js';
import { ensureList, ensureFields, resolveCidadesListId } from './lib/table-utils.js';
import { BUCKET_LIST_SLUG } from './lib/buckets-data.js';
import {
  FONTES_LIST_SLUG,
  LOCAIS_LIST_SLUG,
  ARTISTAS_LIST_SLUG,
  ORGS_LIST_SLUG,
} from '../src/api/mapping.js';

const EVENTOS_SLUG = process.env.OOINFO_EVENTOS_SLUG ?? 'eventos-culturais';

interface CreatedIds {
  fontes: string;
  locais: string;
  artistas: string;
  orgs: string;
  eventos: string;
  buckets: string;
}

async function main() {
  console.log('=== create-all-tables ===\n');

  await login();
  console.log('✓ Login OK\n');

  const CIDADES_LIST_ID = await resolveCidadesListId();
  console.log(`✓ Cidades list: ${CIDADES_LIST_ID}\n`);

  // ── 1. Fontes ──────────────────────────────────────────────────────────────
  console.log('── fontes-de-eventos ──');
  const fontesId = await ensureList(FONTES_LIST_SLUG, {
    name: 'Fontes de Eventos',
    description: 'Origens e scrapers de eventos culturais',
  });
  await ensureFields(fontesId, [
    { key: 'nome',                 name: 'Nome',                  type: 'TEXT',     isRequired: true  },
    { key: 'url_base',             name: 'URL Base',              type: 'URL',      isRequired: false },
    { key: 'tipo',                 name: 'Tipo',                  type: 'TAGS',     isRequired: true  },
    { key: 'ativa',                name: 'Ativa',                 type: 'BOOLEAN',  isRequired: false },
    { key: 'frequencia_de_coleta', name: 'Frequência de Coleta',  type: 'TAGS',     isRequired: false },
    { key: 'observacoes',          name: 'Observações',           type: 'TEXTAREA', isRequired: false },
  ]);

  // ── 2. Locais ──────────────────────────────────────────────────────────────
  console.log('\n── locais-culturais ──');
  const locaisId = await ensureList(LOCAIS_LIST_SLUG, {
    name: 'Locais Culturais',
    description: 'Venues, teatros, casas de show e espaços culturais',
  });
  await ensureFields(locaisId, [
    { key: 'nome',          name: 'Nome',          type: 'TEXT', isRequired: true  },
    { key: 'tipo_de_local', name: 'Tipo de Local', type: 'TAGS', isRequired: false },
    {
      key: 'cidade', name: 'Cidade', type: 'RELATION', isRequired: true,
      configJson: { targetListId: CIDADES_LIST_ID },
    },
    { key: 'endereco', name: 'Endereço', type: 'TEXT', isRequired: false },
    { key: 'bairro',   name: 'Bairro',   type: 'TEXT', isRequired: false },
    { key: 'site',     name: 'Site',     type: 'URL',  isRequired: false },
  ]);

  // ── 3. Artistas ────────────────────────────────────────────────────────────
  console.log('\n── artistas ──');
  const artistasId = await ensureList(ARTISTAS_LIST_SLUG, {
    name: 'Artistas',
    description: 'Artistas e performers de eventos culturais',
  });
  await ensureFields(artistasId, [
    { key: 'nome_artistico', name: 'Nome Artístico', type: 'TEXT', isRequired: true  },
    { key: 'tipo',           name: 'Tipo',           type: 'TAGS', isRequired: false },
  ]);

  // ── 4. Organizações ────────────────────────────────────────────────────────
  console.log('\n── organizacoes-culturais ──');
  const orgsId = await ensureList(ORGS_LIST_SLUG, {
    name: 'Organizações Culturais',
    description: 'Produtoras e instituições que organizam eventos culturais',
  });
  await ensureFields(orgsId, [
    { key: 'nome', name: 'Nome', type: 'TEXT', isRequired: true  },
    { key: 'tipo', name: 'Tipo', type: 'TAGS', isRequired: false },
  ]);

  // ── 5. Eventos ─────────────────────────────────────────────────────────────
  console.log('\n── eventos-culturais ──');
  const eventosId = await ensureList(EVENTOS_SLUG, {
    name: 'Eventos Culturais',
    description: 'Agenda de eventos culturais nas capitais brasileiras',
    settingsJson: { displayMode: 'list', itemsPerPage: 10 },
  });
  await ensureFields(eventosId, [
    { key: 'nome_do_evento',           name: 'Nome do Evento',           type: 'TEXT',     isRequired: true  },
    { key: 'resumo',                   name: 'Resumo',                   type: 'TEXTAREA', isRequired: true  },
    { key: 'descricao_completa',       name: 'Descrição Completa',       type: 'TEXTAREA', isRequired: false },
    { key: 'tipo_de_evento',           name: 'Tipo de Evento',           type: 'TAGS',     isRequired: true  },
    { key: 'categorias',               name: 'Categorias',               type: 'TAGS',     isRequired: true  },
    { key: 'generos_musicais',         name: 'Gêneros Musicais',         type: 'TAGS',     isRequired: false },
    { key: 'formato',                  name: 'Formato',                  type: 'TAGS',     isRequired: true  },
    { key: 'classificacao_indicativa', name: 'Classificação Indicativa', type: 'TAGS',     isRequired: false },
    { key: 'imagem_de_capa',           name: 'Imagem de Capa',           type: 'IMAGE',    isRequired: false },
    { key: 'site_oficial',             name: 'Site Oficial',             type: 'URL',      isRequired: false },
    { key: 'link_geral_de_ingressos',  name: 'Link Ingressos',           type: 'URL',      isRequired: false },
    { key: 'gratuito',                 name: 'Gratuito',                 type: 'BOOLEAN',  isRequired: true  },
    { key: 'nota',                     name: 'Nota',                     type: 'RATING',   isRequired: false },
    { key: 'status',                   name: 'Status',                   type: 'TAGS',     isRequired: true  },
    { key: 'ultima_verificacao',       name: 'Última Verificação',       type: 'DATE',     isRequired: false },
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

  // ── 6. Buckets ─────────────────────────────────────────────────────────────
  console.log('\n── buckets-de-busca ──');
  const bucketsId = await ensureList(BUCKET_LIST_SLUG, {
    name: 'Buckets de Busca',
    description: 'Categorias e hints para o agente de coleta de eventos culturais',
  });
  await ensureFields(bucketsId, [
    { key: 'label',      name: 'Label',         type: 'TEXT', isRequired: true  },
    { key: 'categorias', name: 'Categorias',     type: 'TAGS', isRequired: true  },
    { key: 'hints',      name: 'Hints de Busca', type: 'TAGS', isRequired: false },
  ]);

  // ── Resumo ─────────────────────────────────────────────────────────────────
  const ids: CreatedIds = {
    fontes: fontesId,
    locais: locaisId,
    artistas: artistasId,
    orgs: orgsId,
    eventos: eventosId,
    buckets: bucketsId,
  };

  console.log('\n\n✅ Todas as tabelas prontas!\n');
  console.log('Adicione ao .env:');
  console.log(`OOINFO_LIST_ID_EVENTOS=${ids.eventos}`);
  console.log(`OOINFO_LIST_ID_FONTES=${ids.fontes}`);
  console.log(`OOINFO_LIST_ID_LOCAIS=${ids.locais}`);
  console.log(`OOINFO_LIST_ID_ARTISTAS=${ids.artistas}`);
  console.log(`OOINFO_LIST_ID_ORGS=${ids.orgs}`);
  console.log(`OOINFO_LIST_ID_BUCKETS=${ids.buckets}`);
  console.log('\nDepois rode:');
  console.log('  npm run fontes:seed   # cria entrada do agente em fontes');
  console.log('  npm run buckets:seed  # popula categorias de busca');
}

main().catch((err) => {
  console.error('\n✗ Erro:', err instanceof Error ? err.message : err);
  process.exit(1);
});
