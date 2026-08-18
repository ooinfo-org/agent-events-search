# API ooinfo — análise técnica

Fonte: `https://ooinfo.org/docs` (Swagger UI / OpenAPI 3.0).

**305 endpoints, 45 tags.** Backend NestJS. Auth JWT Bearer. Base path: `/api`.

Documento resume só o que interessa para o agente de eventos culturais. Spec completa salva em `_tmp/openapi.json` (não commitado).

---

## 1. Modelo mental da API

Não existe endpoint `/eventos`. A API é um **CMS de listas dinâmicas** — parecido com Airtable / Notion. Os conceitos:

- **Category** — taxonomia global (árvore, com pai/filho).
- **List** — coleção (ex: "Eventos Culturais", "Cidades do Brasil", "Artistas"). Tem `slug`, `visibilityMode`, campos dinâmicos.
- **Field** — coluna da lista. Tipos: TEXT, NUMBER, DATE, SELECT, MULTISELECT, RATING, RELATION, HIERARCHICAL_CATEGORY, etc.
- **Item** — registro (linha) dentro de uma lista. Valores dos campos são dinâmicos, dependem do schema da lista.
- **Relations** — campos RELATION apontam para itens de outra lista (ex: evento → cidade → capital).

**Consequência:** para inserir um evento, precisamos primeiro descobrir o schema da lista "Eventos" (`GET /api/lists/{listId}/fields`), mapear cada campo do nosso JSON para o `fieldId` correspondente e enviar o payload no formato esperado.

---

## 2. Fluxo de autenticação

```
POST /api/auth/login
  body: { identifier|email, password }
  → { accessToken, refreshToken, user }

POST /api/auth/refresh
  body: { refreshToken }
  → { accessToken, refreshToken }

POST /api/auth/logout          (Bearer)
POST /api/auth/me              (Bearer) → user info
```

Credenciais dev (do pptx): `dev1@decen.info` / senha no cofre.

**Header em todas as chamadas autenticadas:** `Authorization: Bearer <accessToken>`.

---

## 3. Endpoints essenciais para o agente

### 3.1 Descobrir a lista de eventos

```
GET /api/lists                                 # paginado, público
GET /api/lists/slug/{slug}                     # busca por slug (ex: eventos-culturais)
GET /api/lists/slug/{slug}/with-items          # lista + primeira página de itens (1 round-trip)
```

Se ainda não existir lista de eventos, criar:

```
POST /api/lists                                (Bearer)
  body: CreateListDto {
    name*: string,
    slug*: string,
    description, iconBase64, bannerUrl,
    isPublic, visibilityMode: PUBLIC|PRIVATE|LOGGED_IN|INVITED,
    settings, templateId, parentListId
  }
```

### 3.2 Descobrir os campos (schema dinâmico)

```
GET /api/lists/{listId}/fields                 (Bearer)
GET /api/lists/slug/{slug}/fields              # conveniência por slug
GET /api/lists/{listId}/fields/schema          # cache completo
GET /api/lists/{listId}/fields/{fieldId}/options   # opções de SELECT/MULTISELECT/RELATION
```

Antes de inserir qualquer evento, cachear o mapa `{ nomeInterno: fieldId, tipo, opções }`.

### 3.3 Inserir eventos (2 estratégias)

#### 3.3.1 Item por item (JSON)

```
POST /api/lists/{listId}/items                 (Bearer)
  body: CreateItemDto  # payload depende do schema
```

- 1 evento = 1 requisição.
- Bom quando volume pequeno (< 100/dia) ou preciso feedback por item.

#### 3.3.2 Upload CSV em lote (recomendado para o agente diário)

```
GET  /api/uploads/batch/content/{contentId}/template   # template CSV com headers dinâmicos
POST /api/uploads/batch/init                           # inicia sessão de upload
POST /api/uploads/batch/{uploadId}/content             # envia CSV (multipart)
POST /api/uploads/batch/complete                       # dispara processamento
GET  /api/uploads/batch/{uploadId}/status              # polling
GET  /api/uploads/batch/{uploadId}/report              # erros (download)
```

Vantagens: 1 upload por capital (ou 1 upload/dia com todas), dedup + validação server-side, relatório de erros centralizado.

### 3.4 Atualizar / deletar itens

```
PATCH  /api/lists/{listId}/items/{itemId}      (Bearer)
DELETE /api/lists/{listId}/items/{itemId}      (Bearer)
POST   /api/lists/{listId}/items/bulk-delete   (Bearer)   # filter-based
POST   /api/lists/{listId}/items/bulk-field    (Bearer)   # set campo em massa
```

### 3.5 Cidades / capitais (relations)

Do pptx: `ooinfo.org.br/lists/cidades-do-brasil?page=1`. Slug = `cidades-do-brasil`.

```
GET /api/lists/slug/cidades-do-brasil/items    # lista todas as cidades
```

Cachear o mapa `{ nomeCapital: cidadeItemId }` para setar o campo RELATION `cidade` nos eventos.

### 3.6 Categorias (taxonomia)

```
GET /api/categories                            # árvore completa (público)
GET /api/lists/{listId}/categories             # categorias associadas à lista
GET /api/lists/{listId}/categories/hierarchy   # árvore para campos hierarchical_category
```

---

## 4. Alternativa: usar o próprio AI da API

A API tem endpoints de IA que fazem pesquisa web e propõem operações:

```
POST /api/ai/chat/plan                         (Bearer)
  body: CreateAiPlanDto {
    prompt*: string,
    listId: string,
    locale: string,
    allowedSourceUrls: string[],
    allowWebResearch: boolean,
    force: boolean,
    target, history, pageContext
  }
  → planId

POST /api/ai/plans/{id}/confirm                (Bearer)
  body: { apply: boolean, note: string }
```

**Trade-off:** substitui nosso agente TS. Vantagem: 1 chamada única, tudo server-side. Desvantagem: perde controle sobre prompt/model/buckets, custo cai no tenant do ooinfo (não na nossa key). Para POC do nosso agente, **manter fluxo atual** (OpenAI direto) e usar `POST /items` ou batch CSV apenas para inserir.

---

## 4b. Schema real da lista "Eventos Culturais"

Lista descoberta: slug `eventos-culturais-rv77`, `listId = cms3ippif002gwfsw2lo4g4fz`.

**Leitura pública** (sem auth):
- `GET /api/lists/slug/eventos-culturais-rv77` → metadados + fields inline
- `GET /api/lists/slug/eventos-culturais-rv77/fields` → só fields
- `GET /api/lists/cms3ippif002gwfsw2lo4g4fz/items/optimized` → items

**Options de campos TAGS/SELECT/RELATION requer auth** (`401` sem Bearer).

### 4b.1 Campos (20 no total)

| # | key | tipo | req |
|---|-----|------|-----|
| 0 | `nome_do_evento` | TEXT | ✓ |
| 1 | `resumo` | TEXTAREA | ✓ |
| 2 | `descricao_completa` | TEXTAREA | |
| 3 | `tipo_de_evento` | TAGS | ✓ |
| 4 | `categorias` | TAGS | ✓ |
| 5 | `generos_musicais` | TAGS | |
| 6 | `formato` | TAGS | ✓ |
| 7 | `classificacao_indicativa` | TAGS | |
| 8 | `imagem_de_capa` | IMAGE | |
| 9 | `site_oficial` | URL | |
| 10 | `link_geral_de_ingressos` | URL | |
| 11 | `gratuito` | BOOLEAN | ✓ |
| 12 | `nota` | RATING | |
| 13 | `status` | TAGS | ✓ |
| 14 | `ultima_verificacao` | DATE | |
| 15 | `cidade_principal` | RELATION → `cidades-do-brasil` | ✓ |
| 16 | `local_principal` | RELATION | |
| 17 | `artistas` | RELATION | |
| 18 | `organizacoes` | RELATION | |
| 19 | `fontes` | RELATION → `fontes-de-eventos-zt3d` | ✓ |

### 4b.2 IDs de listas relacionadas

| Lista | slug | listId |
|-------|------|--------|
| Eventos Culturais | `eventos-culturais-rv77` | `cms3ippif002gwfsw2lo4g4fz` |
| Cidades do Brasil | `cidades-do-brasil` | `cmqiexdq04ew99hq6efisa78b` |
| Fontes de Eventos | `fontes-de-eventos-zt3d` | `cms3ipmre002awfswn5hpscpx` |

### 4b.3 Shape do payload (POST /items)

Baseado em itens reais retornados pela API:

```json
{
  "values": {
    "nome_do_evento": "Festival Cultural Aurora",
    "resumo": "Descrição curta...",
    "descricao_completa": "Texto longo opcional",
    "tipo_de_evento": ["Festival"],
    "categorias": ["Música"],
    "generos_musicais": ["MPB"],
    "formato": ["Presencial"],
    "classificacao_indicativa": ["Livre"],
    "imagem_de_capa": "https://.../cartaz.jpg",
    "site_oficial": "https://.../evento",
    "link_geral_de_ingressos": "https://sympla.com.br/...",
    "gratuito": true,
    "nota": null,
    "status": ["Ativo"],
    "ultima_verificacao": "2026-08-04",
    "cidade_principal": {
      "id": "cmqig8w3j64n69hq634ylmbd4",
      "listId": "cmqiexdq04ew99hq6efisa78b",
      "listSlug": "cidades-do-brasil",
      "label": "Goiânia / GO"
    },
    "local_principal": null,
    "artistas": null,
    "organizacoes": null,
    "fontes": [
      {
        "id": "cms3jbq8o006wwfsw0iqwuh08",
        "listId": "cms3ipmre002awfswn5hpscpx",
        "listSlug": "fontes-de-eventos-zt3d",
        "label": "Fonte Interna de Testes"
      }
    ]
  }
}
```

**Observações:**
- Campos TAGS = array de strings (aparentemente free-form; validar via options quando autenticado).
- Campos RELATION single = objeto `{id, listId, listSlug, label}` ou `null`.
- Campos RELATION multi = array desses objetos ou `null`.
- BOOLEAN = boolean literal.
- DATE = string `YYYY-MM-DD`.
- RATING pode ser omitido (`null`) na inserção — vem do voto colaborativo.

### 4b.4 Valores TAGS já observados

| Campo | Valores vistos |
|-------|----------------|
| tipo_de_evento | `Festival`, `Exposição` |
| categorias | `Música`, `Artes Visuais` |
| generos_musicais | `MPB` |
| formato | `Presencial`, `Online` |
| classificacao_indicativa | `Livre` |
| status | `Teste` |

⚠️ Amostra minúscula (2 itens). Recomendado: logar como `dev1@decen.info` e chamar `GET /api/lists/{listId}/fields/{fieldId}/options` para cada TAGS/RELATION antes de codar mapper definitivo.

---

## 5. Roadmap de integração

1. **Rotacionar** credenciais expostas no pptx.
2. Fazer login manual via curl / Postman → salvar `LIST_ID_EVENTOS` no `.env`.
3. `GET /api/lists/{listId}/fields` → decidir mapping do nosso `Evento` para campos da API.
4. Escrever `src/api-client.ts`:
   - Login + refresh automático em 401.
   - `getSchemaEventos()` cacheado.
   - `getCapitalIdBySlug(slug)` cacheado.
   - `postEvento(evento)` → converte para payload correto.
5. No `index.ts`, após coletar os eventos, chamar `postEvento` para cada um (ou gerar CSV e usar batch).
6. Configurar dedup do lado do agente (comparar `titulo+data_inicio+local` com itens já existentes via `GET /items/optimized` filtrado).

---

## 6. Convenções observadas

- Paginação: **keyset/cursor** (não offset). Alguns endpoints tem `/optimized` para grandes volumes.
- **ETag** disponível em listas (`GET /api/lists/{id}/etag`) para invalidação de cache.
- **Trash** (soft-delete) em items e fields, com `/restore`.
- **Field history**: cada campo mantém versões (`/items/{id}/fields/{id}/history`).
- **RATING** field tem endpoint dedicado (`POST /items/{itemId}/rate`) — usar isso para o ranking colaborativo do pptx.

---

## 7. Referência rápida

| Ação                          | Endpoint                                                     | Auth |
|------------------------------|--------------------------------------------------------------|------|
| Login                        | `POST /api/auth/login`                                       | —    |
| Refresh                      | `POST /api/auth/refresh`                                     | —    |
| Buscar lista por slug        | `GET /api/lists/slug/{slug}`                                 | —    |
| Schema da lista              | `GET /api/lists/{listId}/fields/schema`                      | ✓    |
| Listar itens                 | `GET /api/lists/{listId}/items/optimized`                    | —    |
| Criar item                   | `POST /api/lists/{listId}/items`                             | ✓    |
| Atualizar item               | `PATCH /api/lists/{listId}/items/{itemId}`                   | ✓    |
| Upload CSV — init            | `POST /api/uploads/batch/init`                               | ✓    |
| Upload CSV — envio           | `POST /api/uploads/batch/{uploadId}/content`                 | ✓    |
| Upload CSV — commit          | `POST /api/uploads/batch/complete`                           | ✓    |
| Cidades                      | `GET /api/lists/slug/cidades-do-brasil/items`                | —    |
| Rating (ranking)             | `POST /api/lists/{listId}/items/{itemId}/rate`               | ✓    |
| Categorias árvore            | `GET /api/categories`                                        | —    |
