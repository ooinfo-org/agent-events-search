#!/usr/bin/env tsx
/**
 * Regenera data/capitais-mapping.json com os IDs reais da lista de cidades no tenant atual.
 * Necessário rodar após migrar de tenant ou ao popular pela primeira vez.
 *
 * Rode: npm run cidades:rebuild
 */
import 'dotenv/config';
import { writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { login, apiRequest } from '../src/api/client.js';
import { getCidadesId } from '../src/api/listIds.js';

interface CityItem {
  id: string;
  values: Record<string, unknown>;
}

interface CapitalMapping {
  capital: string;
  uf: string;
  cityId: string | null;
  matchLabel: string | null;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const MAPPING_PATH = join(__dirname, '..', 'data', 'capitais-mapping.json');

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

async function main() {
  console.log('=== rebuild-cidades-mapping ===\n');
  await login();
  console.log('✓ Login OK');

  const listId = await getCidadesId();
  console.log(`✓ Cidades list: ${listId}\n`);

  // Busca todos os items
  const all: CityItem[] = [];
  let page = 1;
  while (true) {
    const res = await apiRequest<{ data: CityItem[]; pagination?: { hasMore?: boolean } }>(
      `/api/lists/${listId}/items/optimized`,
      { auth: false, query: { page, limit: 500 } },
    );
    all.push(...res.data);
    if (!res.pagination?.hasMore) break;
    page += 1;
    if (page > 50) break;
  }
  console.log(`✓ ${all.length} cidades carregadas`);

  const current: CapitalMapping[] = JSON.parse(readFileSync(MAPPING_PATH, 'utf-8'));

  const updated: CapitalMapping[] = current.map((entry) => {
    // Descobre qual campo tem o label (varia por tenant): tenta cidade_uf, cidade, nome, label
    const match = all.find((c) => {
      const candidates = ['cidade_uf', 'cidade', 'nome', 'label', 'name'];
      for (const k of candidates) {
        const v = c.values[k];
        if (typeof v !== 'string') continue;
        const nv = normalize(v);
        const target = normalize(`${entry.capital} ${entry.uf}`);
        const target2 = normalize(`${entry.capital}/${entry.uf}`);
        const target3 = normalize(`${entry.capital} / ${entry.uf}`);
        if (nv === target || nv === target2 || nv === target3 || nv.includes(target)) return true;
      }
      return false;
    });

    if (!match) {
      console.log(`  ⚠️  ${entry.capital}/${entry.uf} não encontrada`);
      return { ...entry, cityId: null, matchLabel: null };
    }

    const label = (match.values['cidade_uf'] ?? match.values['cidade'] ?? match.values['nome'] ?? match.values['label']) as string;
    return { ...entry, cityId: match.id, matchLabel: label };
  });

  writeFileSync(MAPPING_PATH, JSON.stringify(updated, null, 2), 'utf-8');
  const ok = updated.filter((e) => e.cityId).length;
  console.log(`\n✅ ${MAPPING_PATH} atualizado — ${ok}/${updated.length} capitais mapeadas`);
}

main().catch((err) => {
  console.error('\n✗ Erro:', err instanceof Error ? err.message : err);
  process.exit(1);
});
