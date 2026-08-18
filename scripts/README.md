# Scripts de manutenção

Execute via `npm run <script>` ou diretamente com `npx tsx scripts/<arquivo>.ts`.

---

## Setup completo (ambiente novo)

```bash
# 1. Criar todas as tabelas de uma vez (ordem de dependência garantida)
npm run table:all

# 2. Copiar os IDs impressos para o .env

# 3. Semear dados iniciais
npm run fontes:seed   # entrada do agente na lista de fontes
npm run buckets:seed  # categorias de busca
```

---

## Scripts de criação de tabela

Cada script é idempotente — se a lista ou campo já existir, pula.

| Script | Lista criada | Campos |
| --- | --- | --- |
| `npm run table:all` | todas (em ordem) | — |
| `npm run table:eventos` | `eventos-culturais` | 20 campos |
| `npm run table:fontes` | `fontes-de-eventos` | 6 campos |
| `npm run table:locais` | `locais-culturais` | 6 campos |
| `npm run table:artistas` | `artistas` | 2 campos |
| `npm run table:orgs` | `organizacoes-culturais` | 2 campos |
| `npm run table:buckets` | `buckets-de-busca` | 3 campos |

### Ordem de dependência (table:all já resolve)

```text
fontes → locais → artistas → orgs → eventos → buckets
```

`eventos` depende de fontes, locais, artistas e orgs como campos RELATION.
`cidades-do-brasil` é pré-populada pelo Ooinfo — sem script de criação.

---

## Scripts de seed

| Script | O que faz |
| --- | --- |
| `npm run fontes:seed` | Cria entrada "Agente OpenAI Web Search" na lista de fontes |
| `npm run buckets:seed` | Upserta os 12 buckets de categoria em `buckets-de-busca` |

Ambos são idempotentes. Rode novamente após editar dados.

**Editar buckets:** edite `scripts/lib/buckets-data.ts` e rode `npm run buckets:seed`.

---

## Pré-requisitos no `.env`

```env
USER_LOGIN=...
PASS_LOGIN=...
OOINFO_BASE_URL=https://ooinfo.org.br   # ou ooinfo.org para produção
```

---

## Estrutura dos arquivos

```text
scripts/
  lib/
    table-utils.ts    # ensureList() e ensureFields() compartilhados
    buckets-data.ts   # definição dos 12 buckets (fonte de verdade)
  create-all-tables.ts
  create-table-eventos.ts
  create-table-fontes.ts
  create-table-locais.ts
  create-table-artistas.ts
  create-table-orgs.ts
  create-table-buckets.ts
  seed-fontes.ts
  seed-buckets.ts
```

---

> Adicione aqui novos scripts conforme forem criados.
