import { apiRequest } from '../../src/api/client.js';

export interface FieldDef {
  key: string;
  name: string;
  type: string;
  isRequired?: boolean;
  /** RELATION config. API espera `config` no POST; serializado como `config` no body. */
  configJson?: Record<string, unknown>;
}

interface ListResponse {
  id: string;
  slug: string;
  name: string;
}

interface FieldResponse {
  id: string;
  key: string;
  type: string;
}

export async function ensureList(
  slug: string,
  createBody: {
    name: string;
    description?: string;
    isPublic?: boolean;
    visibilityMode?: 'PUBLIC' | 'PRIVATE' | 'LOGGED_IN' | 'INVITED';
    /** Config de visualização: displayMode "table"|"list"|"cards"|"document"|"gallery"|"feed"|"dashboard", itemsPerPage, etc. */
    settingsJson?: Record<string, unknown>;
  },
): Promise<string> {
  try {
    const list = await apiRequest<ListResponse & { settingsJson?: Record<string, unknown> }>(
      `/api/lists/slug/${slug}`,
      { auth: false },
    );
    console.log(`✓ Lista "${slug}" já existe: ${list.id}`);
    // Se settingsJson pedido diverge do atual, aplica PATCH
    if (createBody.settingsJson) {
      const current = list.settingsJson ?? {};
      const needsUpdate = Object.entries(createBody.settingsJson).some(
        ([k, v]) => JSON.stringify(current[k]) !== JSON.stringify(v),
      );
      if (needsUpdate) {
        await apiRequest(`/api/lists/${list.id}`, {
          method: 'PATCH',
          body: { settingsJson: { ...current, ...createBody.settingsJson } },
        });
        console.log(`  ↻ settingsJson atualizado`);
      }
    }
    return list.id;
  } catch {
    // Não existe. Ooinfo faz soft-delete e reserva o slug — se cair em "Slug já em uso",
    // tenta com sufixo random até 3 vezes.
    const attempts = [slug, `${slug}-${randSuffix()}`, `${slug}-${randSuffix()}`, `${slug}-${randSuffix()}`];
    for (const s of attempts) {
      try {
        console.log(`  Criando lista "${s}"...`);
        const created = await apiRequest<ListResponse>('/api/lists', {
          method: 'POST',
          body: { slug: s, isPublic: true, visibilityMode: 'PUBLIC', ...createBody },
        });
        console.log(`✓ Lista "${s}" criada: ${created.id}`);
        return created.id;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes('Slug já em uso')) throw e;
        console.log(`  ⚠️  slug "${s}" reservado (soft-delete), tentando alternativo...`);
      }
    }
    throw new Error(`Não foi possível criar lista para "${slug}" após múltiplas tentativas`);
  }
}

function randSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

/**
 * Descobre o ID de uma lista no tenant atual.
 * Ordem: env var > slugs candidatos > busca por prefixo em /api/lists.
 * Necessário porque tenants diferentes usam slugs distintos + sufixos aleatórios.
 */
export async function resolveListId(opts: {
  envVar?: string;
  slugCandidates: string[];
  errorHint: string;
}): Promise<string> {
  if (opts.envVar) {
    const fromEnv = process.env[opts.envVar];
    if (fromEnv) {
      // Valida com auth (endpoint tenant-scoped). Endpoint público responde 200 mesmo
      // pra listas de outro tenant, o que é inútil aqui.
      try {
        await apiRequest(`/api/lists/${fromEnv}/fields`);
        return fromEnv;
      } catch {
        console.log(`  ⚠️  ${opts.envVar}=${fromEnv} não existe neste tenant, buscando via slug...`);
      }
    }
  }

  for (const slug of opts.slugCandidates) {
    try {
      const list = await apiRequest<ListResponse>(`/api/lists/slug/${slug}`, { auth: false });
      return list.id;
    } catch {
      // continua
    }
  }

  // Última tentativa: procura por prefixo em /api/lists (slugs geralmente têm sufixo random)
  const prefix = opts.slugCandidates[0];
  try {
    const res = await apiRequest<{ data?: ListResponse[] } | ListResponse[]>(
      '/api/lists?limit=100',
      { auth: false },
    );
    const arr = Array.isArray(res) ? res : (res.data ?? []);
    const match = arr.find((l) => l.slug?.startsWith(prefix));
    if (match) return match.id;
  } catch {
    // ignora
  }

  throw new Error(opts.errorHint);
}

/**
 * Descobre a lista de cidades (pré-populada pelo Ooinfo, slug varia por tenant).
 */
export async function resolveCidadesListId(): Promise<string> {
  return resolveListId({
    envVar: 'OOINFO_LIST_ID_CIDADES',
    slugCandidates: ['cidades-do-brasil', 'cidades-brasileiras', 'cidades'],
    errorHint: 'Lista de cidades não encontrada. Crie-a no Ooinfo ou defina OOINFO_LIST_ID_CIDADES no .env',
  });
}

export async function ensureFields(listId: string, fields: FieldDef[]): Promise<void> {
  let existing: FieldResponse[] = [];
  try {
    const res = await apiRequest<FieldResponse[] | { data: FieldResponse[] }>(
      `/api/lists/${listId}/fields`,
    );
    existing = Array.isArray(res) ? res : (res.data ?? []);
  } catch {
    // nova lista, sem campos
  }

  const existingKeys = new Set(existing.map((f) => f.key));

  for (const field of fields) {
    if (existingKeys.has(field.key)) {
      console.log(`  ✓ Campo "${field.key}" já existe`);
      continue;
    }
    const body: Record<string, unknown> = {
      name: field.name,
      key: field.key,
      type: field.type,
      isRequired: field.isRequired ?? false,
    };
    // API espera "config" no POST (retorna "configJson" no GET).
    if (field.configJson) body['config'] = field.configJson;

    await apiRequest<FieldResponse>(`/api/lists/${listId}/fields`, {
      method: 'POST',
      body,
    });
    console.log(`  ✓ Campo "${field.key}" criado (${field.type})`);
  }
}
