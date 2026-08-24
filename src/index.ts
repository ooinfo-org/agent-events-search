import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CAPITAIS, type Capital } from './capitals.js';
import { coletarEventosCapital } from './agent.js';
import { pushCapital } from './api/push.js';
import type { CapitalEventos } from './schema.js';

const OUTPUT_DIR = 'output';

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
}

function parseArgs(): { capitais: Capital[]; push: boolean; live: boolean } {
  const args = process.argv.slice(2);
  const push = args.includes('--push');
  const live = args.includes('--live');

  const capitalIdx = args.indexOf('--capital');
  if (capitalIdx !== -1 && args[capitalIdx + 1]) {
    const alvo = args[capitalIdx + 1].toLowerCase();
    const match = CAPITAIS.find(
      (c) => c.nome.toLowerCase() === alvo || c.uf.toLowerCase() === alvo,
    );
    if (!match) {
      throw new Error(`Capital não encontrada: ${args[capitalIdx + 1]}`);
    }
    return { capitais: [match], push, live };
  }
  return { capitais: CAPITAIS, push, live };
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('ERRO: OPENAI_API_KEY ausente. Crie um arquivo .env baseado em .env.example');
    process.exit(1);
  }

  const { capitais, push, live } = parseArgs();
  const resultados: CapitalEventos[] = [];

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const ts = timestamp();

  for (const capital of capitais) {
    console.error(`[coletando] ${capital.nome}/${capital.uf}...`);
    try {
      const dados = await coletarEventosCapital(capital);
      console.error(`  → ${dados.eventos.length} eventos`);
      resultados.push(dados);

      const file = join(OUTPUT_DIR, `eventos-${slugify(capital.nome)}-${ts}.json`);
      writeFileSync(file, JSON.stringify(dados, null, 2), 'utf-8');
      console.error(`  💾 ${file}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ falha em ${capital.nome}: ${msg}`);
    }
  }

  if (resultados.length > 1) {
    const combinedFile = join(OUTPUT_DIR, `eventos-todos-${ts}.json`);
    writeFileSync(combinedFile, JSON.stringify(resultados, null, 2), 'utf-8');
    console.error(`\n💾 arquivo combinado: ${combinedFile}`);
  }

  const total = resultados.reduce((sum, r) => sum + r.eventos.length, 0);
  console.error(`\n✓ ${resultados.length} capitais, ${total} eventos totais`);

  if (push) {
    if (!process.env.USER_LOGIN || !process.env.PASS_LOGIN) {
      console.error('\n⚠️  --push requer USER_LOGIN e PASS_LOGIN no .env');
      process.exit(1);
    }
    const dryRun = !live;
    if (dryRun) {
      console.error('\n🧪 modo DRY-RUN (adicione --live para gravar de verdade)');
    } else {
      console.error('\n🔴 modo LIVE — gravando na API ooinfo');
    }

    let g = { created: 0, updated: 0, unchanged: 0, dryRunCreate: 0, dryRunUpdate: 0, dryRunUnchanged: 0, skippedEnded: 0, errors: 0 };
    for (const c of resultados) {
      const s = await pushCapital(c, { dryRun });
      g.created += s.created;
      g.updated += s.updated;
      g.unchanged += s.unchanged;
      g.dryRunCreate += s.dryRunCreate;
      g.dryRunUpdate += s.dryRunUpdate;
      g.dryRunUnchanged += s.dryRunUnchanged;
      g.skippedEnded += s.skippedEnded;
      g.errors += s.errors;
    }

    const encerrados = g.skippedEnded ? `, encerrados=${g.skippedEnded}` : '';
    console.error(
      `\n📊 push total: ${dryRun
        ? `criaria=${g.dryRunCreate}, atualizaria=${g.dryRunUpdate}, sem-mudança=${g.dryRunUnchanged}`
        : `criados=${g.created}, atualizados=${g.updated}, sem-mudança=${g.unchanged}`
      }${encerrados}, erros=${g.errors}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
