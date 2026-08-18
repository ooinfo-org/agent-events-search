import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

interface CapitalMapping {
  capital: string;
  uf: string;
  cityId: string | null;
  matchLabel: string | null;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const MAPPING_PATH = join(__dirname, '..', '..', 'data', 'capitais-mapping.json');

let cache: CapitalMapping[] | null = null;

function load(): CapitalMapping[] {
  if (!cache) {
    cache = JSON.parse(readFileSync(MAPPING_PATH, 'utf-8'));
  }
  return cache!;
}

export function getCityId(nome: string, uf: string): { id: string; label: string } | null {
  const entry = load().find((m) => m.capital === nome && m.uf === uf);
  if (!entry || !entry.cityId || !entry.matchLabel) return null;
  return { id: entry.cityId, label: entry.matchLabel };
}

export const CIDADES_LIST_ID = 'cmqiexdq04ew99hq6efisa78b';
export const CIDADES_LIST_SLUG = 'cidades-do-brasil';
export const FONTES_LIST_ID = 'cms3ipmre002awfswn5hpscpx';
export const FONTES_LIST_SLUG = 'fontes-de-eventos-zt3d';
export const LOCAIS_LIST_ID = 'cms3ip2np0021wfswc3yr8sna';
export const LOCAIS_LIST_SLUG = 'locais-culturais-4dw6';
export const ARTISTAS_LIST_ID = 'cms3ipk4h0024wfsw49j85rwx';
export const ARTISTAS_LIST_SLUG = 'artistas-9noe';
export const ORGS_LIST_ID = 'cms3iplft0027wfswujysih8y';
export const ORGS_LIST_SLUG = 'organizacoes-culturais-1chh';
