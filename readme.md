# base-eventos

Base de conhecimento sobre **Eventos Culturais nas capitais brasileiras**, alimentada por um agente de IA que roda diariamente, coleta dados na internet e insere na API do projeto **ooinfo / redecult**.

---

## 1. Objetivo

Construir um **diretório colaborativo de eventos culturais** (peças, shows, feiras, festivais, etc.) das capitais do Brasil, com:

- Coleta automática diária via **agente de IA**.
- Inserção estruturada na **API pública** (`ooinfo.org/docs`).
- **Ranking colaborativo** — usuários avaliam os melhores eventos por categoria.
- **Complementação humana** — quando o agente não obtém preço, localização ou o evento é novo, a comunidade completa. Comentários e chat integrados.
- Site consumidor da base (`ooinfo.org` prod / `ooinfo.org.br` dev).

---

## 2. Escopo da coleta

- **Segmentação:** por **capital** (26 capitais + DF).
- **Fonte:** internet aberta (portais culturais, agendas municipais, Sympla, Ingresso.com, sites de espaços culturais, redes sociais de artistas, sites institucionais).
- **Frequência:** diária (agendamento automático).
- **Janela temporal:** eventos de hoje + próximos dias (ver exemplo abaixo).

---

## 3. Modelo de dados

### 3.1 Categorias da base de conhecimento

O grafo cultural tem **Eventos** no centro, conectado a 8 categorias satélites:

```text
     Notícias        Mercado de Pulgas        Projetos Culturais
         \                 |                       /
          \                |                      /
   Artistas ---- EVENTOS (Peças, Shows, ---- Acervos Digitais
                 Feiras, Festivais)
          /                |                      \
         /                 |                       \
   Instituições         Espaços                Gastronomia
```

### 3.2 Entidade `Evento` — campos obrigatórios

Ordem de prioridade dada no pptx:

| Campo             | Tipo         | Obrigatório | Observação                              |
|-------------------|--------------|-------------|------------------------------------------|
| `data`            | date         | sim         | Data do evento                           |
| `evento`          | string       | sim         | Nome / título                            |
| `tipo_evento`     | enum         | **sim**     | Peça, Show, Feira, Festival, etc.        |
| `genero_musical`  | enum/string  | **sim**     | Aplicável quando tipo = Show/Festival    |
| `local`           | string       | sim         | Nome do espaço                           |
| `endereco`        | string       | recomendado | Endereço textual                         |
| `capital`         | enum         | sim         | Capital de segmentação                   |
| `horario`         | time         | sim         | Início                                   |
| `destaque`        | string       | não         | Artistas, obras, curadoria               |
| `ingresso`        | object       | recomendado | `{ plataforma, url, preco }` — ex. Sympla |
| `nota`            | float 0-5    | **sim**     | Média colaborativa (default 0)           |
| `fonte_url`       | url          | sim         | Origem da informação (auditoria)         |
| `coletado_em`     | datetime     | sim         | Timestamp da coleta pelo agente          |

### 3.3 Ordem de construção (definida no pptx)

1. **Modelagem dos dados** (foco em `Evento`).
2. **Coleta / listas** via agente.
3. **Site consumidor** sobre a base.

---

## 4. Arquitetura

```text
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Agente IA   │────▶│  Agendador   │────▶│    API       │
│  (LLM +      │     │  diário      │     │  ooinfo.org  │
│  scraping)   │     │  (cron)      │     │  /docs       │
└──────────────┘     └──────────────┘     └──────────────┘
                                                  │
                                                  ▼
                                          ┌──────────────┐
                                          │ Base de      │
                                          │ conhecimento │
                                          └──────────────┘
                                                  │
                                                  ▼
                                          ┌──────────────┐
                                          │ Site + comu- │
                                          │ nidade       │
                                          │ (ranking,    │
                                          │ chat)        │
                                          └──────────────┘
```

**Fluxo:**

1. Agendador dispara agente por capital.
2. Agente consulta LLM + faz busca/scraping segmentado.
3. Normaliza saída para o schema `Evento`.
4. `POST` na API — dedup por `(evento, data, local)`.
5. Site expõe base; comunidade rankeia/complementa.

---

## 5. Formato de saída do agente

Baseado no exemplo do pptx (slide 5).

### 5.1 Tabela — exemplo humano

**Eventos de hoje (03/06 - Quarta)**

| Evento                     | Local                            | Horário | Detalhes                                                                            | Ingresso |
| -------------------------- | -------------------------------- | ------- | ----------------------------------------------------------------------------------- | -------- |
| III Goiânia Blues Festival | Teatro Sesc Centro (R. 3, s/nº)  | 20h     | André Mols + Grupo Som Corrente. Blues, jazz cultural. Grátis.                      | Gratuito |
| Liga Joe                   | Bolshoi Pub (R. T-53, 140)       | 22h     | Rock nacional autoral, energia alta e nostalgia. Uma das raízes do rock em Goiânia. | Sympla   |

**Recomendações para os próximos dias (04 a 07/06)**

| Data            | Evento                                                            | Local                         | Horário | Gênero/Destaque                             | Ingresso |
| --------------- | ----------------------------------------------------------------- | ----------------------------- | ------- | ------------------------------------------- | -------- |
| 04/06           | Ló Borges e o legado do Clube da Esquina                          | Elegia Café                   | 20h     | MPB de altíssima qualidade                  | Sympla   |
| 05/06           | Jorge Ben e Tim Maia                                              | Elegia Café                   | 20h     | Homenagem aos mestres do samba, funk e soul | Sympla   |
| 05/06           | O Grilo                                                           | Centro Cultural Martim Cererê | 20h     | Rock/indie brasileiro                       | Sympla   |
| 06/06           | Jazz Fusion Soundscapes — Ney Guzhoners-Rieti                     | Elegia Café                   | 20h     | Jazz especial                               | Sympla   |
| 07/06 (Domingo) | Rodrigo Teaser (Kevin Dorsey, LaVelle Smith Jr., Jennifer Batten) | Centro de Convenções da PUC   | —       | Show especial                               | —        |

### 5.2 JSON — o que vai pra API

```json
{
  "capital": "Goiânia",
  "coletado_em": "2026-06-03T06:00:00-03:00",
  "eventos": [
    {
      "data": "2026-06-03",
      "evento": "III Goiânia Blues Festival",
      "tipo_evento": "Festival",
      "genero_musical": "Blues/Jazz",
      "local": "Teatro Sesc Centro",
      "endereco": "R. 3, s/nº - Centro, Goiânia",
      "horario": "20:00",
      "destaque": "André Mols + Grupo Som Corrente",
      "ingresso": { "plataforma": null, "url": null, "preco": 0 },
      "nota": 0,
      "fonte_url": "https://exemplo.com/agenda-goiania"
    }
  ]
}
```

---

## 6. Ambientes e credenciais

| Item                    | Valor                                                  |
|-------------------------|--------------------------------------------------------|
| Produção                | https://ooinfo.org                                     |
| Desenvolvimento         | https://ooinfo.org.br                                  |
| Docs API                | https://ooinfo.org/docs                                |
| Lista de cidades        | https://ooinfo.org.br/lists/cidades-do-brasil?page=1   |
| Usuário dev             | `dev1@decen.info`                                      |
| Senha dev               | *(ver cofre — NÃO commitar)*                           |
| Token OpenAI            | *(ver `.env` — NÃO commitar)*                          |

> ⚠️ **Segurança:** o arquivo `base-eventos (2).pptx` contém credenciais em texto puro (senha do usuário dev e chave OpenAI `sk-proj-...`). **Rotacionar imediatamente** ambos os segredos e remover do pptx. Adicionar `*.pptx` ao `.gitignore` até sanitização.

---

## 7. Tarefas a executar (roadmap)

- [ ] Ler `ooinfo.org/docs` — mapear endpoints de `Evento`, `Espaço`, `Artista`, `Cidade`.
- [ ] Baixar lista de capitais em `ooinfo.org.br/lists/cidades-do-brasil`.
- [ ] Definir schema `Evento` final alinhado com API existente.
- [ ] Implementar agente:
  - [ ] Prompt de coleta por capital (busca web + LLM).
  - [ ] Normalizador → schema.
  - [ ] Dedup + `POST` na API.
- [ ] Configurar agendamento diário (cron / task scheduler / GitHub Actions).
- [ ] Log de execução por capital (sucesso, falha, nº eventos).
- [ ] Handler de campos ausentes → marcar `precisa_complemento_comunidade = true`.
- [ ] Testes com 1 capital piloto (Goiânia) antes de escalar.

---

## 8. Como rodar o agente

### 8.1 Setup

```bash
npm install
cp .env.example .env
# editar .env e colocar OPENAI_API_KEY real
```

### 8.2 Comandos

```bash
# roda todas as 27 capitais (salva 1 JSON por capital + 1 combinado em output/)
npm run dev

# roda apenas uma capital (por nome ou UF)
npm run dev -- --capital Goiânia
npm run dev -- --capital SP

# modo debug (mostra qtd de web_search por bucket)
# bash/zsh:
DEBUG=1 npm run dev -- --capital Goiânia
# PowerShell:
$env:DEBUG="1"; npm run dev -- --capital Goiânia

# type check
npm run typecheck
```

Arquivos gerados em `output/`:

- `eventos-<capital>-<YYYY-MM-DD_HH-MM>.json` — 1 por capital
- `eventos-todos-<YYYY-MM-DD_HH-MM>.json` — combinado (só se >1 capital)

### 8.3 Como funciona

- `src/capitals.ts` — lista das 27 capitais.
- `src/schema.ts` — schema Zod + JSON Schema (structured output OpenAI).
- `src/agent.ts` — chama Responses API com tool `web_search_preview` + `json_schema` strict.
- `src/index.ts` — loop nas capitais, imprime `JSON.stringify(resultados, null, 2)` no stdout. Logs de progresso vão pro stderr (não poluem o JSON).

Nada é persistido — saída pura no stdout, pronta pra pipe / redirect.

### 8.4 Variáveis de ambiente

| Var                      | Default       | Descrição                                 |
| ------------------------ | ------------- | ----------------------------------------- |
| `OPENAI_API_KEY`         | —             | Obrigatória                               |
| `OPENAI_MODEL`           | `gpt-4o-mini` | Modelo com suporte a `web_search_preview` |
| `EVENT_LOOKAHEAD_DAYS`   | `7`           | Janela futura de coleta                   |
| `MAX_EVENTS_PER_CAPITAL` | `15`          | Teto de eventos por capital               |

---

## 9. Referências

- Diagrama de categorias: `_pptx_extract/ppt/media/image1.png`
- Exemplo de saída do agente: `_pptx_extract/ppt/media/image2.png`
- Fonte original: `base-eventos (2).pptx`
