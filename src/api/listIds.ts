/**
 * Cache central de IDs de listas do Ooinfo, resolvidos dinamicamente no primeiro uso.
 * Ordem: env var (validada com auth) → slug → busca por prefixo.
 * Evita que IDs hardcoded stale de outro tenant quebrem o push.
 */
import { resolveListId } from './resolveList.js';

let eventosId: string | null = null;
let fontesId: string | null = null;
let locaisId: string | null = null;
let artistasId: string | null = null;
let orgsId: string | null = null;
let cidadesId: string | null = null;

export async function getEventosId(): Promise<string> {
  if (eventosId) return eventosId;
  eventosId = await resolveListId({
    envVar: 'OOINFO_LIST_ID_EVENTOS',
    slugCandidates: ['eventos-culturais'],
    errorHint: 'Lista de eventos não encontrada. Rode `npm run table:eventos`.',
  });
  return eventosId;
}

export async function getFontesId(): Promise<string> {
  if (fontesId) return fontesId;
  fontesId = await resolveListId({
    envVar: 'OOINFO_LIST_ID_FONTES',
    slugCandidates: ['fontes-de-eventos'],
    errorHint: 'Lista de fontes não encontrada. Rode `npm run table:fontes`.',
  });
  return fontesId;
}

export async function getLocaisId(): Promise<string> {
  if (locaisId) return locaisId;
  locaisId = await resolveListId({
    envVar: 'OOINFO_LIST_ID_LOCAIS',
    slugCandidates: ['locais-culturais'],
    errorHint: 'Lista de locais não encontrada. Rode `npm run table:locais`.',
  });
  return locaisId;
}

export async function getArtistasId(): Promise<string> {
  if (artistasId) return artistasId;
  artistasId = await resolveListId({
    envVar: 'OOINFO_LIST_ID_ARTISTAS',
    slugCandidates: ['artistas'],
    errorHint: 'Lista de artistas não encontrada. Rode `npm run table:artistas`.',
  });
  return artistasId;
}

export async function getOrgsId(): Promise<string> {
  if (orgsId) return orgsId;
  orgsId = await resolveListId({
    envVar: 'OOINFO_LIST_ID_ORGS',
    slugCandidates: ['organizacoes-culturais'],
    errorHint: 'Lista de organizações não encontrada. Rode `npm run table:orgs`.',
  });
  return orgsId;
}

export async function getCidadesId(): Promise<string> {
  if (cidadesId) return cidadesId;
  cidadesId = await resolveListId({
    envVar: 'OOINFO_LIST_ID_CIDADES',
    slugCandidates: ['cidades-do-brasil', 'cidades-brasileiras', 'cidades'],
    errorHint: 'Lista de cidades não encontrada. Defina OOINFO_LIST_ID_CIDADES no .env.',
  });
  return cidadesId;
}
