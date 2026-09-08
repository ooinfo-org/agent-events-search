import { apiRequest } from './client.js';

interface ListResponse {
  id: string;
  slug?: string;
  name?: string;
}

/**
 * Resolve o ID de uma lista do Ooinfo no tenant atual.
 * Ordem: env var (valida com auth) → slugs candidatos → busca por prefixo em /api/lists.
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
      // Valida com auth (endpoint tenant-scoped) — endpoint público responde 200
      // pra listas de outro tenant, o que é inútil aqui.
      try {
        await apiRequest(`/api/lists/${fromEnv}/fields`);
        return fromEnv;
      } catch {
        // cai no fallback
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
