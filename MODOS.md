# Modos de Busca — base-eventos

O sistema suporta 4 modos de busca independentes. Todos usam o mesmo OpenAI para **extrair** os eventos; o que varia é **como** o conteúdo da web chega ao modelo.

---

## Modo 1 — Simples

**O modelo faz a busca por conta própria** usando a ferramenta nativa `web_search_preview` (OpenAI) ou o plugin Exa (OpenRouter `:online`). Nenhuma configuração de busca extra é necessária.

**Quando usar:** Teste rápido, conta OpenAI padrão, não quer depender de chaves extras.

**Limitação:** O modelo decide o que buscar e como. Menos controle, custo embutido no plano OpenAI.

### Configuração (`.env`)

```env
AGENT_PROVIDER=openai
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4.1
```

### Comando

```bash
npm run modo:simples -- --capital Goiânia
npm run modo:simples -- --capital Goiânia --push --live
```

---

## Modo 2 — Brave API

**Busca via Brave Search API** (índice independente do Google). O código busca as queries, visita as páginas top, monta contexto, e faz **1 chamada LLM** por bucket.

**Quando usar:** Quer busca controlada sem custo alto. 2.000 buscas/mês grátis.

**Custo:** Gratuito até 2.000 buscas/mês. [Criar conta em api.search.brave.com](https://api.search.brave.com)

### Configuração (`.env`)

```env
AGENT_PROVIDER=openai
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4.1
BRAVE_API_KEY=BSA...
```

### Comando

```bash
npm run modo:brave -- --capital Goiânia
npm run modo:brave -- --capital Goiânia --push --live
```

---

## Modo 3 — Tavily API

**Busca via Tavily** — API feita para agentes de IA. Retorna conteúdo completo das páginas (não só snippets), maior qualidade.

**Quando usar:** Quer maior qualidade na extração de eventos. 1.000 buscas/mês grátis.

**Custo:** 1.000 buscas/mês grátis, depois $5/1.000. [Criar conta em app.tavily.com](https://app.tavily.com)

### Configuração (`.env`)

```env
AGENT_PROVIDER=openai
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4.1
TAVILY_API_KEY=tvly-...
```

### Comando

```bash
npm run modo:tavily -- --capital Goiânia
npm run modo:tavily -- --capital Goiânia --push --live
```

---

## Modo 4 — Browser (Playwright)

**Abre um navegador headless (Chromium)**, busca no Bing, visita as páginas dos eventos, extrai o conteúdo renderizado em JavaScript. Completamente gratuito, sem chave de API.

**Quando usar:** Quer busca gratuita e sem dependência de APIs externas. Sites que precisam de JavaScript para carregar o conteúdo.

**Requisito único:** instalar o Chromium uma vez:

```bash
npx playwright install chromium
```

**Limitação:** Mais lento (~2s por busca), pode ser bloqueado por alguns sites com Cloudflare agressivo.

### Configuração (`.env`)

```env
AGENT_PROVIDER=openai
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4.1
# Nenhuma variável extra necessária
```

### Comando

```bash
npm run modo:browser -- --capital Goiânia
npm run modo:browser -- --capital Goiânia --push --live
```

---

## Tabela Comparativa

| Modo | Comando | Custo de Busca | Chave Extra | Qualidade |
|------|---------|---------------|-------------|-----------|
| Simples | `modo:simples` | Embutido no OpenAI | — | Boa |
| Brave | `modo:brave` | 2k/mês grátis | `BRAVE_API_KEY` | Boa |
| Tavily | `modo:tavily` | 1k/mês grátis | `TAVILY_API_KEY` | Melhor (conteúdo completo) |
| Browser | `modo:browser` | Grátis | — | Boa (JS renderizado) |

---

## Flags Comuns

```bash
--capital <Nome|UF>     # capital específica (ex: Goiânia, GO, "São Paulo")
--push                  # ativa o push para ooinfo (dry-run sem essa flag)
--live                  # confirma push para produção/dev
```

**Exemplos:**

```bash
# Testar coleta sem salvar no ooinfo
npm run modo:simples -- --capital Goiânia

# Salvar no ooinfo (ambiente dev)
npm run modo:browser -- --capital Goiânia --push --live

# Debug — ver detalhes das buscas
cross-env DEBUG=1 npm run modo:browser -- --capital Goiânia
```

---

## Diagnóstico de Busca

Testa um provedor de busca isolado (sem chamar o LLM):

```bash
npm run debug:search "shows sertanejos Goiânia" playwright
npm run debug:search "shows sertanejos Goiânia" brave
npm run debug:search "shows sertanejos Goiânia" tavily
```
