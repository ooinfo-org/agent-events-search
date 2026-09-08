# Setup do Ooinfo — criação das tabelas

Guia completo para provisionar as 6 listas (tabelas) que o agente `base-eventos` usa no Ooinfo. Útil para setup em tenant novo, ambiente de dev, ou reset.

---

## 1. Pré-requisitos

### 1.1 Credenciais no `.env`

```env
OOINFO_BASE_URL=https://ooinfo.org.br   # dev; use https://ooinfo.org em produção
USER_LOGIN=seu-email@dominio
PASS_LOGIN=sua-senha
```

O usuário precisa ter permissão de **criar listas** no workspace/tenant.

### 1.2 Dependências

```bash
npm install
```

---

## 2. Setup rápido (tudo de uma vez)

```bash
# 1) Cria as 6 tabelas em ordem correta de dependência
npm run table:all

# 2) Copie os IDs impressos ao final para o .env
#    Exemplo do output:
#      OOINFO_LIST_ID_EVENTOS=cms3ippif002gwfsw2lo4g4fz
#      OOINFO_LIST_ID_FONTES=cms3ipmre002awfswn5hpscpx
#      ...

# 3) Popula dados iniciais
npm run fontes:seed    # cria "Agente OpenAI Web Search" na lista de fontes
npm run buckets:seed   # popula 12 categorias de busca do agente

# 4) Testa coleta (não faz push ainda)
npm run modo:simples -- --capital Goiânia

# 5) Push dry-run (simula sem gravar)
npm run modo:simples -- --capital Goiânia --push

# 6) Push real
npm run modo:simples -- --capital Goiânia --push --live
```

---

## 3. Ordem de dependência

`table:all` já resolve automaticamente. Se rodar scripts individuais, respeite:

```text
fontes → locais → artistas → orgs → eventos → buckets
```

Motivo: `eventos` tem campos RELATION apontando para `fontes`, `locais`, `artistas`, `orgs`. Precisam existir antes.

`cidades-do-brasil` NÃO é criada aqui — é pré-populada pelo Ooinfo.

---

## 4. Schema de cada tabela

Todos os scripts são **idempotentes**: se a lista ou campo já existir, pula (não duplica). Cada script imprime o `list_id` para adicionar ao `.env`.

### 4.1 `fontes-de-eventos`

Fontes/origens de coleta. O agente cria uma entrada única "Agente OpenAI Web Search" via `fontes:seed`.

| Campo | Tipo | Obrigatório | Uso |
|---|---|---|---|
| `nome` | TEXT | ✅ | Nome da fonte |
| `url_base` | URL | — | URL raiz da plataforma |
| `tipo` | TAGS | ✅ | `Automatizada` \| `Manual` |
| `ativa` | BOOLEAN | — | Fonte em uso |
| `frequencia_de_coleta` | TAGS | — | `Diária` \| `Semanal` \| `Manual` |
| `observacoes` | TEXTAREA | — | Notas livres |

**Comando:** `npm run table:fontes`
**Env:** `OOINFO_LIST_ID_FONTES=<id>`

---

### 4.2 `locais-culturais`

Venues (teatros, casas de show, museus, galerias, etc). O agente faz upsert por nome+cidade.

| Campo | Tipo | Obrigatório | Uso |
|---|---|---|---|
| `nome` | TEXT | ✅ | Nome do venue |
| `tipo_de_local` | TAGS | — | Teatro, Casa de Shows, Centro Cultural, Museu, Galeria, Bar, Restaurante, Estádio, Espaço Público, Outro |
| `cidade` | RELATION → `cidades-do-brasil` | ✅ | Cidade do venue |
| `endereco` | TEXT | — | Endereço textual |
| `bairro` | TEXT | — | Bairro |
| `site` | URL | — | Site oficial |

**Comando:** `npm run table:locais`
**Env:** `OOINFO_LIST_ID_LOCAIS=<id>`

---

### 4.3 `artistas`

Artistas, bandas, palestrantes. Upsert por `nome_artistico`.

| Campo | Tipo | Obrigatório | Uso |
|---|---|---|---|
| `nome_artistico` | TEXT | ✅ | Nome do artista/banda |
| `tipo` | TAGS | — | Solo, Banda, Grupo, DJ, Companhia, Palestrante, Outro |

**Comando:** `npm run table:artistas`
**Env:** `OOINFO_LIST_ID_ARTISTAS=<id>`

---

### 4.4 `organizacoes-culturais`

Produtoras, instituições, prefeituras que organizam eventos.

| Campo | Tipo | Obrigatório | Uso |
|---|---|---|---|
| `nome` | TEXT | ✅ | Nome da organização |
| `tipo` | TAGS | — | Produtora, Instituição Pública, ONG, Coletivo, Patrocinador, Empresa, Outro |

**Comando:** `npm run table:orgs`
**Env:** `OOINFO_LIST_ID_ORGS=<id>`

---

### 4.5 `eventos-culturais`

Tabela central. 20 campos, 5 RELATION.

| Campo | Tipo | Obrigatório | Uso |
|---|---|---|---|
| `nome_do_evento` | TEXT | ✅ | Título |
| `resumo` | TEXTAREA | ✅ | Descrição curta (≤500 chars) |
| `descricao_completa` | TEXTAREA | — | Descrição rica (com data, local, ingresso, fonte) |
| `tipo_de_evento` | TAGS | ✅ | Show, Peça, Festival, Feira, Exposição, Cinema, Palestra, Outro |
| `categorias` | TAGS | ✅ | Derivadas do tipo (Música, Teatro, Gastronomia, etc.) |
| `generos_musicais` | TAGS | — | Sertanejo, Rock, MPB, etc. |
| `formato` | TAGS | ✅ | Presencial, Online |
| `classificacao_indicativa` | TAGS | — | Livre, 10+, 12+, 14+, 16+, 18+ |
| `imagem_de_capa` | IMAGE | — | Extraída via og:image / JSON-LD / Next.js |
| `site_oficial` | URL | — | Site do evento |
| `link_geral_de_ingressos` | URL | — | Link de compra (Sympla, etc.) |
| `gratuito` | BOOLEAN | ✅ | Derivado do preço |
| `nota` | RATING | — | Ranking colaborativo |
| `status` | TAGS | ✅ | Ativo, Encerrado |
| `ultima_verificacao` | DATE | — | Data da última coleta |
| `cidade_principal` | RELATION → `cidades-do-brasil` | ✅ | Cidade do evento |
| `local_principal` | RELATION → `locais-culturais` | — | Venue |
| `artistas` | RELATION → `artistas` | — | Lineup |
| `organizacoes` | RELATION → `organizacoes-culturais` | — | Produtoras |
| `fontes` | RELATION → `fontes-de-eventos` | ✅ | Origem da informação |

**Comando:** `npm run table:eventos`
**Env:** `OOINFO_LIST_ID_EVENTOS=<id>`

---

### 4.6 `buckets-de-busca`

Categorias/hints usados pelo agente para paralelizar buscas web. Editável em runtime via `buckets:seed`.

| Campo | Tipo | Obrigatório | Uso |
|---|---|---|---|
| `label` | TEXT | ✅ | Nome do bucket (ex: `shows-sertanejo`) |
| `categorias` | TAGS | ✅ | Tipos de evento aceitos (Show, Festival, ...) |
| `hints` | TAGS | — | Termos de busca (`shows sertanejos`, `agenda sertanejo`, ...) |

**Comando:** `npm run table:buckets`
**Env:** `OOINFO_LIST_ID_BUCKETS=<id>`

**Editar buckets:** modifique `scripts/lib/buckets-data.ts` e rode `npm run buckets:seed`.

---

## 5. Seeds

### 5.1 `fontes:seed`

Cria a entrada única "Agente OpenAI Web Search" na lista de fontes. Idempotente — pula se já existir.

```bash
npm run fontes:seed
```

Valores gravados:
```json
{
  "nome": "Agente OpenAI Web Search",
  "url_base": "https://api.openai.com/",
  "tipo": ["Automatizada"],
  "ativa": true,
  "frequencia_de_coleta": ["Diária"],
  "observacoes": "Fonte automática: agente TypeScript usando OpenAI Responses API + web_search_preview."
}
```

### 5.2 `buckets:seed`

Popula os 12 buckets padrão em `buckets-de-busca`. Faz upsert por `label` — pode rodar N vezes.

```bash
npm run buckets:seed
```

Buckets criados: `shows-sertanejo`, `shows-samba-pagode-forro-mpb`, `shows-rock-pop-indie`, `shows-eletronica-hiphop-funk`, `shows-gospel-jazz-classica`, `shows-internacional-tributos`, `teatro-danca-standup`, `exposicoes-arte`, `cinema-mostras`, `feiras-mercados`, `gastronomia-festivais`, `familia-infantil`.

---

## 6. Verificação

### 6.1 Confirmar tabelas criadas

Após `table:all`, verifique no painel Ooinfo (`/lists`) ou via API:

```bash
curl -s "$OOINFO_BASE_URL/api/lists/slug/eventos-culturais" | jq '.id, .name'
```

### 6.2 Confirmar buckets carregados

```bash
npx tsx -e "
import { fetchBuckets } from './src/api/fetchBuckets.js';
const b = await fetchBuckets([]);
console.log(b.length, 'buckets');
b.forEach(x => console.log(' -', x.label));
"
```

### 6.3 Rodar coleta de teste

```bash
npm run modo:simples -- --capital Goiânia
# saída: output/eventos-goiania-<timestamp>.json
```

### 6.4 Push dry-run

```bash
npm run modo:simples -- --capital Goiânia --push
# simula sem gravar — mostra criaria=N, atualizaria=N
```

### 6.5 Push real

```bash
npm run modo:simples -- --capital Goiânia --push --live
```

---

## 7. Troubleshooting

### Erro: `Cidade não mapeada: X/UF`

`cidades-do-brasil` deve ter as 27 capitais pré-cadastradas. Se falta uma, adicione manualmente no Ooinfo com o campo `cidade_uf` no formato `Nome UF` (ex: `Goiânia GO`). O ID vai em `src/api/mapping.ts`.

### Erro: `Lista alvo (X) não encontrada` ao criar RELATION

RELATION aponta pra cidades. O tenant pode não ter o slug `cidades-do-brasil` — pode ser `cidades-brasileiras` ou outro. Os scripts resolvem via `resolveCidadesListId()` que testa slugs conhecidos. Se falhar, defina `OOINFO_LIST_ID_CIDADES` no `.env` com o ID da lista de cidades do seu tenant.

### Erro: `Login falhou`

Verifique `USER_LOGIN` e `PASS_LOGIN` no `.env`. Confirme que o `OOINFO_BASE_URL` aponta pro ambiente correto (`ooinfo.org.br` = dev, `ooinfo.org` = prod).

### Erro ao criar campo RELATION

O `targetListId` no `configJson` precisa apontar pra uma lista **existente**. Rode `table:all` (resolve ordem) ou crie as tabelas alvo primeiro.

### Erro: `Slug já em uso`

Ooinfo faz **soft-delete** de listas: mesmo após deletar, o slug fica reservado. O `ensureList` tenta 3 sufixos aleatórios automaticamente (ex: `eventos-culturais-a3k9`). Se persistir, escolha um slug único via env var (`OOINFO_EVENTOS_SLUG=eventos-culturais-v2`).

### Duplicatas em buckets

`buckets:seed` faz upsert por `label`. Se aparecerem duplicatas, deletar via UI e rodar novamente.

### Push cria eventos errados

- Ver eventos coletados: `output/eventos-<capital>-<ts>.json`
- Ver logs do push: cada evento imprime `✅ novo`, `📝 atualizado`, `⏭️ sem mudança`, `⏩ encerrado`, `❌ erro`
- Rodar em dry-run primeiro (sem `--live`) pra ver o que seria feito

---

## 8. Estrutura de arquivos

```text
scripts/
  lib/
    table-utils.ts        # ensureList() e ensureFields() (helpers compartilhados)
    buckets-data.ts       # source of truth dos 12 buckets
  create-all-tables.ts    # orquestrador em ordem de dependência
  create-table-eventos.ts
  create-table-fontes.ts
  create-table-locais.ts
  create-table-artistas.ts
  create-table-orgs.ts
  create-table-buckets.ts
  seed-fontes.ts
  seed-buckets.ts
```

Para adicionar nova tabela: copie um `create-table-*.ts` como base, adicione ao `package.json` e ao `create-all-tables.ts`.
