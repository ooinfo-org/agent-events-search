import { apiRequest } from './client.js';
import { FONTES_LIST_ID, FONTES_LIST_SLUG } from './mapping.js';

const FONTE_LABEL_AGENTE = 'Agente OpenAI Web Search';

interface FonteItem {
  id: string;
  values: Record<string, unknown>;
}

interface ItemsResponse<T> {
  data: T[];
  pagination?: { hasMore?: boolean };
}

let cached: { id: string; label: string; listId: string; listSlug: string } | null = null;

function extractLabel(values: Record<string, unknown>): string {
  const candidates = ['label', 'nome', 'titulo', 'title', 'name'];
  for (const k of candidates) {
    const v = values[k];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return '';
}

export async function ensureFonteAgente(): Promise<{ id: string; label: string; listId: string; listSlug: string }> {
  if (cached) return cached;

  const items = await apiRequest<ItemsResponse<FonteItem>>(
    `/api/lists/${FONTES_LIST_ID}/items/optimized`,
    { auth: false, query: { limit: 200 } },
  );

  for (const it of items.data) {
    const label = extractLabel(it.values);
    if (label === FONTE_LABEL_AGENTE) {
      cached = { id: it.id, label, listId: FONTES_LIST_ID, listSlug: FONTES_LIST_SLUG };
      return cached;
    }
  }

  const values: Record<string, unknown> = {
    nome: FONTE_LABEL_AGENTE,
    url_base: 'https://api.openai.com/',
    tipo: ['Automatizada'],
    ativa: true,
    frequencia_de_coleta: ['Diária'],
    observacoes: 'Fonte automática: agente TypeScript usando OpenAI Responses API + web_search_preview.',
  };

  const created = await apiRequest<{ id: string }>(
    `/api/lists/${FONTES_LIST_ID}/items`,
    { method: 'POST', body: { values } },
  );

  cached = { id: created.id, label: FONTE_LABEL_AGENTE, listId: FONTES_LIST_ID, listSlug: FONTES_LIST_SLUG };
  return cached;
}
