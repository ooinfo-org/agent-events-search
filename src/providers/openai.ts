import OpenAI from 'openai';
import type { LlmProvider, LlmProviderResult } from './types.js';

export function createOpenAiProvider(): LlmProvider {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

  return {
    name: 'openai',
    model,
    async collectBucket(prompt: string, jsonSchema: object): Promise<LlmProviderResult> {
      const response = await client.responses.create({
        model,
        tools: [{ type: 'web_search_preview', search_context_size: 'high' }],
        input: prompt,
        text: {
          format: {
            type: 'json_schema',
            name: 'eventos_bucket',
            strict: true,
            schema: jsonSchema as Record<string, unknown>,
          },
        },
      });
      const toolCalls = response.output.filter((o) => o.type === 'web_search_call').length;
      return { text: response.output_text ?? '', toolCalls };
    },
  };
}
