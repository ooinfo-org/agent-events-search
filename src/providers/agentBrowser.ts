import OpenAI from 'openai';
import type { LlmProvider, LlmProviderResult } from './types.js';
import { createPlaywrightProvider, visitPage } from '../search/playwright.js';

const MAX_ITERATIONS = 12;
const MAX_RETRIES = 3;
const DEBUG = process.env.DEBUG === '1';

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search',
      description: 'Busca no Bing por eventos culturais. Use múltiplas vezes com queries diferentes para encontrar mais eventos.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Termo de busca em português. Ex: "shows sertanejos Goiânia agosto 2026"' },
          num_results: { type: 'number', description: 'Número de resultados (1-10, padrão 5)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'visit_page',
      description: 'Visita uma URL e retorna o conteúdo textual da página. Use para ler listas de eventos, páginas de ingressos, sites de casas de shows.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL completa da página a visitar' },
        },
        required: ['url'],
      },
    },
  },
];

async function chatWithRetry(
  client: OpenAI,
  params: Parameters<typeof client.chat.completions.create>[0],
): Promise<OpenAI.Chat.ChatCompletion> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await client.chat.completions.create(params) as OpenAI.Chat.ChatCompletion;
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      const isNoCredits = String(err).includes('no credits') || String(err).includes('insufficient_quota');
      if (status === 429 && !isNoCredits && attempt < MAX_RETRIES - 1) {
        const match = String(err).match(/try again in ([\d.]+)s/);
        const waitMs = match ? Math.ceil(parseFloat(match[1]) * 1000) + 500 : 10_000;
        console.error(`    [agent-browser] 429 — aguardando ${(waitMs / 1000).toFixed(1)}s...`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error('chatWithRetry: max retries exceeded');
}

const searchProvider = createPlaywrightProvider();

export function createAgentBrowserProvider(): LlmProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY ausente no .env');

  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  const client = new OpenAI({ apiKey });
  const concurrency = Number(process.env.AGENT_BROWSER_CONCURRENCY ?? '2');

  return {
    name: 'agent-browser',
    model,
    concurrency,

    async collectBucket(prompt: string, jsonSchema: object): Promise<LlmProviderResult> {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'user', content: prompt },
      ];

      let totalToolCalls = 0;

      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const response = await chatWithRetry(client, {
          model,
          messages,
          tools: TOOLS,
          tool_choice: 'auto',
        });

        const choice = response.choices[0];

        if (choice.finish_reason === 'stop' || !choice.message.tool_calls?.length) {
          const text = choice.message.content ?? '';

          if (text.includes('"eventos"')) {
            return { text, toolCalls: totalToolCalls };
          }

          // Força extração estruturada com o que coletou
          messages.push(choice.message);
          const finalRes = await chatWithRetry(client, {
            model,
            messages: [...messages, { role: 'user', content: 'Agora retorne o JSON com todos os eventos encontrados.' }],
            response_format: {
              type: 'json_schema',
              json_schema: { name: 'eventos_bucket', strict: true, schema: jsonSchema as Record<string, unknown> },
            },
          });
          return { text: finalRes.choices[0]?.message?.content ?? '', toolCalls: totalToolCalls };
        }

        // Executa tool calls
        messages.push(choice.message);

        for (const tc of choice.message.tool_calls) {
          totalToolCalls++;
          let result: string;
          try {
            const args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
            if (tc.function.name === 'search') {
              const q = String(args['query'] ?? '');
              const n = Number(args['num_results'] ?? 5);
              if (DEBUG) console.error(`    [agent-browser] search: "${q}"`);
              const results = await searchProvider.search(q, Math.min(n, 10));
              result = results.length > 0
                ? results.map((r, idx) => `[${idx + 1}] ${r.title}\n    URL: ${r.url}\n    ${r.snippet}`).join('\n\n')
                : '(sem resultados)';
            } else if (tc.function.name === 'visit_page') {
              const url = String(args['url'] ?? '');
              if (DEBUG) console.error(`    [agent-browser] visit: ${url}`);
              result = await visitPage(url);
            } else {
              result = `Ferramenta desconhecida: ${tc.function.name}`;
            }
          } catch (err) {
            result = `Erro: ${err instanceof Error ? err.message : String(err)}`;
          }

          messages.push({ role: 'tool', content: result, tool_call_id: tc.id });
        }
      }

      // Esgotou iterações — extrai o que tiver
      const finalRes = await chatWithRetry(client, {
        model,
        messages: [...messages, { role: 'user', content: 'Retorne agora o JSON com todos os eventos encontrados até agora.' }],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'eventos_bucket', strict: true, schema: jsonSchema as Record<string, unknown> },
        },
      });
      return { text: finalRes.choices[0]?.message?.content ?? '', toolCalls: totalToolCalls };
    },
  };
}
