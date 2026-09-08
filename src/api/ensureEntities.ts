import { apiRequest } from './client.js';
import { getLocaisId, getArtistasId, getOrgsId } from './listIds.js';

interface Item {
  id: string;
  values: Record<string, unknown>;
}
interface ItemsResponse {
  data: Item[];
  pagination?: { hasMore?: boolean };
}

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

// caches: chave por lista+chave normalizada → itemId
const cacheLocais = new Map<string, string>();
const cacheArtistas = new Map<string, string>();
const cacheOrgs = new Map<string, string>();
let cachesCarregados = { locais: false, artistas: false, orgs: false };

async function fetchAllItems(listId: string): Promise<Item[]> {
  const all: Item[] = [];
  let page = 1;
  while (true) {
    const res = await apiRequest<ItemsResponse>(
      `/api/lists/${listId}/items/optimized`,
      { auth: false, query: { page, limit: 500 } },
    );
    all.push(...res.data);
    if (!res.pagination?.hasMore) break;
    page += 1;
    if (page > 50) break;
  }
  return all;
}

async function loadLocaisCache() {
  if (cachesCarregados.locais) return;
  const listId = await getLocaisId();
  const items = await fetchAllItems(listId);
  for (const it of items) {
    const nome = (it.values['nome'] as string) ?? '';
    const cidadeRef = it.values['cidade'];
    const cidadeId = typeof cidadeRef === 'string' ? cidadeRef : (cidadeRef as { id?: string } | null)?.id ?? '';
    if (nome && cidadeId) cacheLocais.set(`${normalize(nome)}|${cidadeId}`, it.id);
  }
  cachesCarregados.locais = true;
}

async function loadArtistasCache() {
  if (cachesCarregados.artistas) return;
  const listId = await getArtistasId();
  const items = await fetchAllItems(listId);
  for (const it of items) {
    const nome = (it.values['nome_artistico'] as string) ?? '';
    if (nome) cacheArtistas.set(normalize(nome), it.id);
  }
  cachesCarregados.artistas = true;
}

async function loadOrgsCache() {
  if (cachesCarregados.orgs) return;
  const listId = await getOrgsId();
  const items = await fetchAllItems(listId);
  for (const it of items) {
    const nome = (it.values['nome'] as string) ?? '';
    if (nome) cacheOrgs.set(normalize(nome), it.id);
  }
  cachesCarregados.orgs = true;
}

export async function ensureLocal(
  local: { nome: string; tipo?: string | null; endereco?: string | null; bairro?: string | null; site?: string | null },
  cityId: string,
): Promise<string | null> {
  await loadLocaisCache();
  const key = `${normalize(local.nome)}|${cityId}`;
  const cached = cacheLocais.get(key);
  if (cached) return cached;

  const values: Record<string, unknown> = {
    nome: local.nome,
    tipo_de_local: [local.tipo ?? 'Outro'],
    cidade: cityId,
  };
  if (local.endereco) values['endereco'] = local.endereco;
  if (local.bairro) values['bairro'] = local.bairro;
  if (local.site) values['site'] = local.site;

  try {
    const listId = await getLocaisId();
    const created = await apiRequest<{ id: string }>(
      `/api/lists/${listId}/items`,
      { method: 'POST', body: { values } },
    );
    cacheLocais.set(key, created.id);
    return created.id;
  } catch (err) {
    console.error(`    ⚠️  local ${local.nome} falhou: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

export async function ensureArtista(artista: { nome_artistico: string; tipo?: string | null }): Promise<string | null> {
  await loadArtistasCache();
  const key = normalize(artista.nome_artistico);
  const cached = cacheArtistas.get(key);
  if (cached) return cached;

  const values: Record<string, unknown> = {
    nome_artistico: artista.nome_artistico,
    tipo: [artista.tipo ?? 'Outro'],
  };

  try {
    const listId = await getArtistasId();
    const created = await apiRequest<{ id: string }>(
      `/api/lists/${listId}/items`,
      { method: 'POST', body: { values } },
    );
    cacheArtistas.set(key, created.id);
    return created.id;
  } catch (err) {
    console.error(`    ⚠️  artista ${artista.nome_artistico} falhou: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

export async function ensureOrg(org: { nome: string; tipo?: string | null }): Promise<string | null> {
  await loadOrgsCache();
  const key = normalize(org.nome);
  const cached = cacheOrgs.get(key);
  if (cached) return cached;

  const values: Record<string, unknown> = {
    nome: org.nome,
    tipo: [org.tipo ?? 'Outro'],
  };

  try {
    const listId = await getOrgsId();
    const created = await apiRequest<{ id: string }>(
      `/api/lists/${listId}/items`,
      { method: 'POST', body: { values } },
    );
    cacheOrgs.set(key, created.id);
    return created.id;
  } catch (err) {
    console.error(`    ⚠️  org ${org.nome} falhou: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}
