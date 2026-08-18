import OpenAI from 'openai';
import type { LlmProvider, LlmProviderResult } from './types.js';

// OpenRouter é OpenAI-compatible via /v1 base. Modelos com sufixo ":online"
// ativam plugin de web search automático (Exa). Exemplos:
//   - openai/gpt-4o:online
//   - anthropic/claude-3.5-sonnet:online
//   - google/gemini-2.0-flash-exp:online
export function createOpenRouterProvider(): LlmProvider {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY ausente no .env');

  const client = new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.OPENROUTER_REFERER ?? 'https://ooinfo.org.br',
      'X-Title': process.env.OPENROUTER_TITLE ?? 'base-eventos',
    },
  });

  const configuredModel = process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o:online';
  // Garante sufixo :online (web search) se user esqueceu.
  const model = configuredModel.includes(':online') ? configuredModel : `${configuredModel}:online`;

  return {
    name: 'openrouter',
    model,
    async collectBucket(prompt: string, jsonSchema: object): Promise<LlmProviderResult> {
      const response = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'eventos_bucket',
            strict: true,
            schema: jsonSchema as Record<string, unknown>,
          },
        },
      });
      const content = response.choices[0]?.message?.content ?? '';
      return { text: content, toolCalls: 0 };
    },
  };
}
