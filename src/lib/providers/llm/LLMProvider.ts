/**
 * Provider-agnostic interface for text (vocabulary information) generation.
 *
 * Implementations receive a system prompt and a user prompt and must return a
 * raw JSON string. Prompt construction and JSON parsing/normalisation live in
 * VocabularyFetcher so they are shared across every provider.
 */
export interface LLMProvider {
  generateJSON(systemPrompt: string, userPrompt: string): Promise<string>;
}
