import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { apiRequest, login, LIST_ID_EVENTOS } from './client.js';
import { CAPITAIS } from '../capitals.js';

const OUT_DIR = '_tmp';

interface Field {
  id: string;
  key: string;
  name: string;
  type: string;
  isRequired: boolean;
  order: number;
}

interface OptionsResponse {
  type: string;
  fieldId: string;
  targetListId?: string;
  labelFieldId?: string;
  totalCount?: number;
  options: Array<{ label: string; value: string }>;
}

interface ItemsResponse<T = unknown> {
  data: T[];
  pagination?: { totalCount?: number; hasMore?: boolean; nextCursor?: string | null };
}

interface CityItem {
  id: string;
  listId: string;
  values: Record<string, unknown>;
}

const inspectTypes = new Set(['TAGS', 'SELECT', 'MULTISELECT', 'RELATION']);

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

async function fetchAllCities(): Promise<Array<{ id: string; label: string }>> {
  const all: Array<{ id: string; label: string }> = [];
  let page = 1;
  const limit = 500;
  while (true) {
    const res = await apiRequest<ItemsResponse<CityItem>>(
      `/api/lists/cmqiexdq04ew99hq6efisa78b/items/optimized`,
      { auth: false, query: { page, limit } },
    );
    for (const item of res.data) {
      const label =
        (item.values['cidade_uf'] as string | undefined) ??
        (item.values['cidade'] as string | undefined) ??
        '';
      all.push({ id: item.id, label });
    }
    console.error(`  cidades: página ${page} (+${res.data.length}, total ${all.length})`);
    if (!res.pagination?.hasMore) break;
    page += 1;
    if (page > 20) break;
  }
  return all;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.error('→ login...');
  await login();
  console.error('  ✓ autenticado');

  console.error(`→ fetching fields da lista ${LIST_ID_EVENTOS}...`);
  const fields = await apiRequest<Field[]>(`/api/lists/${LIST_ID_EVENTOS}/fields`);
  console.error(`  ${fields.length} campos`);

  const report: Record<string, unknown> = {
    listId: LIST_ID_EVENTOS,
    fields: [] as unknown[],
  };

  for (const f of fields.sort((a, b) => a.order - b.order)) {
    const entry: Record<string, unknown> = {
      order: f.order,
      key: f.key,
      name: f.name,
      type: f.type,
      isRequired: f.isRequired,
    };
    if (inspectTypes.has(f.type)) {
      try {
        const opts = await apiRequest<OptionsResponse>(
          `/api/lists/${LIST_ID_EVENTOS}/fields/${f.id}/options`,
        );
        entry['options'] = opts;
        console.error(
          `  [${f.type}] ${f.key} → totalCount=${opts.totalCount ?? '?'}, sample=${opts.options.length}`,
        );
        if (f.type === 'RELATION' && opts.targetListId) {
          entry['targetListId'] = opts.targetListId;
        }
      } catch (err) {
        entry['optionsError'] = err instanceof Error ? err.message : String(err);
        console.error(`  [${f.type}] ${f.key} → ERRO: ${entry['optionsError']}`);
      }
    }
    (report.fields as unknown[]).push(entry);
  }

  const reportPath = join(OUT_DIR, 'api-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.error(`\n💾 ${reportPath}`);

  console.error('\n→ montando mapa capital → cidadeItemId...');
  const cities = await fetchAllCities();
  console.error(`  ${cities.length} cidades carregadas`);

  const mapping: Array<{ capital: string; uf: string; cityId: string | null; matchLabel: string | null }> = [];
  for (const c of CAPITAIS) {
    const expected = normalize(`${c.nome} / ${c.uf}`);
    const found = cities.find((city) => normalize(city.label) === expected);
    mapping.push({
      capital: c.nome,
      uf: c.uf,
      cityId: found?.id ?? null,
      matchLabel: found?.label ?? null,
    });
    if (!found) console.error(`  ✗ não achou ${c.nome}/${c.uf}`);
  }

  const mapPath = join(OUT_DIR, 'capitais-mapping.json');
  writeFileSync(mapPath, JSON.stringify(mapping, null, 2), 'utf-8');
  const okCount = mapping.filter((m) => m.cityId).length;
  console.error(`\n💾 ${mapPath} — ${okCount}/${mapping.length} capitais mapeadas`);

  console.error('\n→ amostra de items existentes (pra derivar valores TAGS)...');
  const items = await apiRequest<ItemsResponse<{ values: Record<string, unknown> }>>(
    `/api/lists/${LIST_ID_EVENTOS}/items/optimized`,
    { auth: false, query: { limit: 100 } },
  );
  const tagValues: Record<string, Set<string>> = {};
  for (const it of items.data) {
    for (const [k, v] of Object.entries(it.values)) {
      if (Array.isArray(v)) {
        for (const x of v) {
          if (typeof x === 'string') {
            (tagValues[k] ??= new Set()).add(x);
          }
        }
      }
    }
  }
  const tagsSummary: Record<string, string[]> = {};
  for (const [k, s] of Object.entries(tagValues)) tagsSummary[k] = [...s];
  const tagsPath = join(OUT_DIR, 'tags-observadas.json');
  writeFileSync(tagsPath, JSON.stringify(tagsSummary, null, 2), 'utf-8');
  console.error(`💾 ${tagsPath} — ${items.data.length} items analisados`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
