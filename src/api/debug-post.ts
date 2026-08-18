import 'dotenv/config';
import { apiRequest, login, LIST_ID_EVENTOS } from './client.js';
import { ensureFonteAgente } from './ensureFonte.js';
import { getCityId, CIDADES_LIST_ID, CIDADES_LIST_SLUG } from './mapping.js';

async function tryPost(label: string, body: Record<string, unknown>): Promise<void> {
  console.error(`\n=== ${label} ===`);
  console.error('BODY:', JSON.stringify(body).slice(0, 300));
  try {
    const res = await apiRequest<{ id: string }>(
      `/api/lists/${LIST_ID_EVENTOS}/items`,
      { method: 'POST', body },
    );
    console.error(`✅ criado id=${res.id}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ ${msg.slice(0, 400)}`);
  }
}

async function main() {
  await login();
  const fonte = await ensureFonteAgente();
  const city = getCityId('Goiânia', 'GO')!;

  const rels = {
    cidade_principal: { id: city.id, listId: CIDADES_LIST_ID, listSlug: CIDADES_LIST_SLUG, label: city.label },
    fontes: [{ id: fonte.id, listId: fonte.listId, listSlug: fonte.listSlug, label: fonte.label }],
  };

  const requiredValues = {
    nome_do_evento: 'DEBUG - shape test',
    resumo: 'x',
    tipo_de_evento: ['Show'],
    categorias: ['Música'],
    formato: ['Presencial'],
    gratuito: true,
    status: ['Ativo'],
    ...rels,
  };

  // A. {values: {...}}
  await tryPost('A. wrapped values', { values: requiredValues });

  // B. flat top-level
  await tryPost('B. flat', requiredValues);

  // C. RELATION apenas com id (string)
  await tryPost('C. RELATION apenas id string', {
    values: {
      nome_do_evento: 'DEBUG C - rel id str',
      resumo: 'x',
      tipo_de_evento: ['Show'],
      categorias: ['Música'],
      formato: ['Presencial'],
      gratuito: true,
      status: ['Ativo'],
      cidade_principal: city.id,
      fontes: [fonte.id],
    },
  });

  // D. RELATION obj com só { id }
  await tryPost('D. RELATION {id} apenas', {
    values: {
      nome_do_evento: 'DEBUG D - rel {id}',
      resumo: 'x',
      tipo_de_evento: ['Show'],
      categorias: ['Música'],
      formato: ['Presencial'],
      gratuito: true,
      status: ['Ativo'],
      cidade_principal: { id: city.id },
      fontes: [{ id: fonte.id }],
    },
  });

  // E. data: {values}
  await tryPost('E. data wrapper', { data: { values: requiredValues } });

  // F. item: {values}
  await tryPost('F. item wrapper', { item: { values: requiredValues } });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
