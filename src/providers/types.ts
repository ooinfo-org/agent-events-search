export interface LlmProviderResult {
  text: string;
  toolCalls: number;
}

export interface LlmProvider {
  name: string;
  model: string;
  concurrency?: number;
  collectBucket(prompt: string, jsonSchema: object, queries?: string[]): Promise<LlmProviderResult>;
}
