import { CapitalEventosSchema, EventoSchema, eventoJsonSchema, type CapitalEventos, type Evento } from './schema.js';
import { hasMojibake } from './api/mojibake.js';
import { checkAliveConcurrent } from './api/validateUrl.js';
import { getProvider } from './providers/index.js';
import type { Capital } from './capitals.js';
import { fetchBuckets, type CategoryBucket } from './api/fetchBuckets.js';

const LOOKAHEAD_DAYS = Number(process.env.EVENT_LOOKAHEAD_DAYS ?? 7);
const MAX_EVENTS = Number(process.env.MAX_EVENTS_PER_CAPITAL ?? 15);
const DEBUG = process.env.DEBUG === '1';

const provider = getProvider();

const BUCKETS: CategoryBucket[] = [
  {
    label: 'shows-sertanejo',
    categorias: ['Show', 'Festival'],
    hints: ['shows sertanejos', 'agenda sertanejo', 'festival sertanejo', 'buteco', 'camarote sertanejo'],
  },
  {
    label: 'shows-samba-pagode-forro-mpb',
    categorias: ['Show', 'Festival'],
    hints: ['shows samba', 'shows pagode', 'shows forró', 'shows MPB', 'roda de samba'],
  },
  {
    label: 'shows-rock-pop-indie',
    categorias: ['Show', 'Festival'],
    hints: ['shows rock', 'shows pop', 'shows indie', 'concerto', 'festival rock'],
  },
  {
    label: 'shows-eletronica-hiphop-funk',
    categorias: ['Show', 'Festival'],
    hints: ['festas eletrônicas', 'shows hip hop', 'shows funk', 'baile'],
  },
  {
    label: 'shows-gospel-jazz-classica',
    categorias: ['Show', 'Festival'],
    hints: ['shows gospel', 'shows jazz', 'concerto música clássica', 'orquestra'],
  },
  {
    label: 'shows-internacional-tributos',
    categorias: ['Show', 'Festival'],
    hints: ['shows internacionais', 'tributos', 'cover'],
  },
  {
    label: 'teatro-danca-standup',
    categorias: ['Peça'],
    hints: ['peças de teatro', 'espetáculos de dança', 'stand up comedy', 'ballet', 'ópera'],
  },
  {
    label: 'exposicoes-arte',
    categorias: ['Exposição'],
    hints: ['exposições', 'museus agenda', 'mostras de arte', 'galerias'],
  },
  {
    label: 'cinema-mostras',
    categorias: ['Cinema'],
    hints: ['cinema alternativo', 'mostra de cinema', 'cineclube', 'estreias'],
  },
  {
    label: 'feiras-mercados',
    categorias: ['Feira'],
    hints: ['feiras culturais', 'feira criativa', 'mercado', 'brechó', 'feira de artesanato'],
  },
  {
    label: 'gastronomia-festivais',
    categorias: ['Festival', 'Outro'],
    hints: ['festival gastronômico', 'festival cerveja', 'food truck', 'festival vinho'],
  },
  {
    label: 'familia-infantil',
    categorias: ['Peça', 'Show', 'Outro'],
    hints: ['eventos infantis', 'peças infantis', 'espetáculo infantil', 'programação criança'],
  },
];

function buildPrompt(capital: Capital, bucket: CategoryBucket): string {
  const hoje = new Date().toISOString().slice(0, 10);
  return `Você é um agente de coleta de eventos culturais. Use a ferramenta web_search MÚLTIPLAS VEZES (mínimo 3 buscas distintas) para encontrar eventos reais em **${capital.nome} - ${capital.uf}**.

**RESTRIÇÃO CRÍTICA DE DATA:** SÓ retorne eventos com \`data_inicio\` >= **${hoje}** (hoje) e <= **próximos ${LOOKAHEAD_DAYS} dias**. **IGNORE** qualquer evento que já aconteceu antes de ${hoje}. Verifique a data antes de incluir.

          FOCO DESTA BUSCA: **${bucket.categorias.join(', ')}**.

          Termos de busca sugeridos (varie e combine com "${capital.nome}"):
          ${bucket.hints.map((h) => `- ${h} ${capital.nome}`).join('\n')}

          Fontes preferidas: Sympla, Ingresso.com, sites oficiais de teatros/centros culturais/prefeituras, agendas culturais locais, sites de espaços culturais.

          META: retornar entre **5 e 10 eventos** desta categoria. Se encontrar menos, faça mais buscas com termos diferentes. Se encontrar zero após 4 buscas, retorne array vazio.

          Regras estritas:
          - **NÃO invente eventos.** Cada evento deve ter \`fonte_url\` real que você visitou.
          - Só use categorias: ${bucket.categorias.join(' | ')} (nada fora disso).
          - \`link_evento\` = URL oficial do evento (obrigatório real, valida via HTTP).
          - \`link_foto\` = URL direta da imagem SE tiver **certeza** (viu explicitamente na página). NÃO invente URLs seguindo padrões de CMS. Se não tiver certeza, use null — nosso código extrai a imagem da página do evento automaticamente via og:image.
          - Datas em ISO YYYY-MM-DD.
          - Se campo desconhecido = null (não invente).
          - IGNORE cursos, consultorias, workshops de negócios, coaching, autoajuda — foco é **cultura**.
          - \`local_detalhes\`: classifique o venue (Teatro, Casa de Shows, Centro Cultural, Museu, Galeria, Bar, Restaurante, Estádio, Espaço Público, Outro). bairro e site opcionais.
          - \`artistas\`: separe os artistas em itens individuais. Ex: "Chitãozinho & Xororó + Zezé Di Camargo & Luciano" → 4 itens: [{nome_artistico:"Chitãozinho & Xororó",tipo:"Banda"},{nome_artistico:"Zezé Di Camargo & Luciano",tipo:"Banda"}...]. Se duo/dupla é uma unidade artística, mantém junto (ex: "Chitãozinho & Xororó" é 1 artista). Para peças/exposições sem artistas conhecidos, array vazio.
          - \`organizacoes\`: produtora ou instituição que organiza (ex: "Prefeitura de Goiânia", "Sesc Goiás", "T4F"). Array vazio se não souber.

          Retorne apenas o JSON estruturado.`;
}

async function coletarBucket(capital: Capital, bucket: CategoryBucket): Promise<Evento[]> {
  try {
    const queries = bucket.hints.slice(0, 3).map((h) => `${h} ${capital.nome}`);
    const { text, toolCalls } = await provider.collectBucket(buildPrompt(capital, bucket), eventoJsonSchema, queries);
    if (DEBUG) {
      console.error(`    [${bucket.label}] tool calls: ${toolCalls}`);
    }
    if (!text) return [];
    const parsed = JSON.parse(text);
    return parsed.eventos ?? [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`    ✗ bucket ${bucket.label} falhou: ${msg}`);
    return [];
  }
}

function normalizeTitle(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // remove prefixos comuns
    .replace(/^(show|concerto|apresentação|apresentacao|exibição|exibicao|espetáculo|espetaculo|peça|peca|festival)s?\s*:?\s*/i, '')
    // remove sufixo " - <local>" ou " no <local>"
    .replace(/\s+[-–—]\s+.+$/, '')
    .replace(/\s+(no|na|em)\s+.+$/i, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedup(eventos: Evento[]): Evento[] {
  const seen = new Set<string>();
  const out: Evento[] = [];
  for (const e of eventos) {
    const key = `${normalizeTitle(e.titulo)}|${e.data_inicio ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

function filtrarPassados(eventos: Evento[]): { validos: Evento[]; removidos: number } {
  const hoje = new Date().toISOString().slice(0, 10);
  const validos: Evento[] = [];
  let removidos = 0;
  for (const e of eventos) {
    // Se data_fim existir e for >= hoje, ainda é válido (multi-dia). Senão usa data_inicio.
    const dataRef = e.data_fim && e.data_fim >= hoje ? e.data_fim : e.data_inicio;
    if (!dataRef || dataRef < hoje) {
      removidos += 1;
      continue;
    }
    validos.push(e);
  }
  return { validos, removidos };
}

async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= tasks.length) return;
      results[idx] = await tasks[idx]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

export async function coletarEventosCapital(capital: Capital): Promise<CapitalEventos> {
  const buckets = await fetchBuckets(BUCKETS);
  const concurrency = provider.concurrency ?? buckets.length;
  console.error(`  → provider=${provider.name} model=${provider.model} — disparando ${buckets.length} buscas (concorrência: ${concurrency})...`);
  const resultados = await runWithConcurrency(buckets.map((b) => () => coletarBucket(capital, b)), concurrency);
  const brutos = resultados.flat();

  const validos: Evento[] = [];
  let descartadosSchema = 0;
  let descartadosMojibake = 0;
  for (const raw of brutos) {
    const r = EventoSchema.safeParse(raw);
    if (!r.success) {
      descartadosSchema += 1;
      continue;
    }
    if (hasMojibake(r.data.titulo) || hasMojibake(r.data.descricao)) {
      descartadosMojibake += 1;
      continue;
    }
    validos.push(r.data);
  }
  const { validos: futuros, removidos: passados } = filtrarPassados(validos);
  const totalDescartados = descartadosSchema + descartadosMojibake + passados;
  if (totalDescartados) {
    console.error(`  ⚠️  ${totalDescartados} descartados (${descartadosSchema} schema + ${descartadosMojibake} mojibake + ${passados} passados)`);
  }

  const unicos = dedup(futuros).slice(0, MAX_EVENTS);

  console.error(`  → validando ${unicos.length} link_evento (HEAD)...`);
  const alive = await checkAliveConcurrent(unicos, (e) => e.link_evento, 6);
  const comLinkValido: Evento[] = [];
  let linksQuebrados = 0;
  for (let i = 0; i < unicos.length; i += 1) {
    if (alive[i]) comLinkValido.push(unicos[i]);
    else linksQuebrados += 1;
  }
  if (linksQuebrados) console.error(`  ⚠️  ${linksQuebrados} descartados (link_evento quebrado)`);

  const payload: CapitalEventos = {
    capital: capital.nome,
    uf: capital.uf,
    coletado_em: new Date().toISOString(),
    eventos: comLinkValido,
  };

  return CapitalEventosSchema.parse(payload);
}