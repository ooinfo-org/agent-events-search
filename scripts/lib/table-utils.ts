import { apiRequest } from '../../src/api/client.js';

export interface FieldDef {
  key: string;
  name: string;
  type: string;
  isRequired?: boolean;
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
  },
): Promise<string> {
  try {
    const list = await apiRequest<ListResponse>(`/api/lists/slug/${slug}`, { auth: false });
    console.log(`✓ Lista "${slug}" já existe: ${list.id}`);
    return list.id;
  } catch {
    console.log(`  Criando lista "${slug}"...`);
    const created = await apiRequest<ListResponse>('/api/lists', {
      method: 'POST',
      body: { slug, isPublic: true, visibilityMode: 'PUBLIC', ...createBody },
    });
    console.log(`✓ Lista "${slug}" criada: ${created.id}`);
    return created.id;
  }
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
    if (field.configJson) body['configJson'] = field.configJson;

    await apiRequest<FieldResponse>(`/api/lists/${listId}/fields`, {
      method: 'POST',
      body,
    });
    console.log(`  ✓ Campo "${field.key}" criado (${field.type})`);
  }
}
