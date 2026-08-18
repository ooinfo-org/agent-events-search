import { login } from './client.js';
import { ensureFonteAgente } from './ensureFonte.js';
import { mapEvento } from './mapEvento.js';
import { upsertEvento, type UpsertResult } from './upsertEvento.js';
import type { CapitalEventos } from '../schema.js';

interface Summary {
  created: number;
  updated: number;
  unchanged: number;
  dryRunCreate: number;
  dryRunUpdate: number;
  dryRunUnchanged: number;
  errors: number;
}

function emptySummary(): Summary {
  return { created: 0, updated: 0, unchanged: 0, dryRunCreate: 0, dryRunUpdate: 0, dryRunUnchanged: 0, errors: 0 };
}

function tally(summary: Summary, r: UpsertResult) {
  switch (r.action) {
    case 'created': summary.created += 1; break;
    case 'updated': summary.updated += 1; break;
    case 'unchanged': summary.unchanged += 1; break;
    case 'dry-run-create': summary.dryRunCreate += 1; break;
    case 'dry-run-update': summary.dryRunUpdate += 1; break;
    case 'dry-run-unchanged': summary.dryRunUnchanged += 1; break;
  }
}

export async function pushCapital(
  capitalData: CapitalEventos,
  opts: { dryRun: boolean },
): Promise<Summary> {
  const summary = emptySummary();
  console.error(`\n📤 push ${capitalData.capital}/${capitalData.uf} (${opts.dryRun ? 'DRY-RUN' : 'LIVE'})...`);
  await login();
  const fonte = await ensureFonteAgente();

  for (const evento of capitalData.eventos) {
    try {
      const mapped = await mapEvento(evento, { nome: capitalData.capital, uf: capitalData.uf }, fonte);
      const result = await upsertEvento(mapped, opts);
      tally(summary, result);

      const mark: Record<UpsertResult['action'], string> = {
        'created': '✅ novo',
        'updated': '📝 atualizado',
        'unchanged': '⏭️  sem mudança',
        'dry-run-create': '🟢 [dry] criaria',
        'dry-run-update': '🟡 [dry] atualizaria',
        'dry-run-unchanged': '⚪ [dry] sem mudança',
      };
      const extra = 'diffKeys' in result && result.diffKeys.length ? ` (${result.diffKeys.join(', ')})` : '';
      console.error(`  ${mark[result.action]}: ${evento.titulo}${extra}`);
    } catch (err) {
      summary.errors += 1;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ ${evento.titulo}: ${msg}`);
    }
  }

  return summary;
}
