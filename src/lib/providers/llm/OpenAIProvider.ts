import OpenAI from 'openai';
import { LLMProvider } from './LLMProvider';
import { LLMError } from '../../../types';

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = process.env.OPENAI_MODEL || 'gpt-4.1-mini') {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async generateJSON(systemPrompt: string, userPrompt: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new LLMError('No content received from OpenAI');
      }
      return content;
    } catch (error) {
      if (error instanceof LLMError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new LLMError(`Error fetching from OpenAI: ${error.message}`);
      }
      throw new LLMError('Unknown error occurred while fetching from OpenAI');
    }
  }
}
