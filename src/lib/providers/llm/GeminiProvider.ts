import { LLMProvider } from './LLMProvider';
import { LLMError } from '../../../types';

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

/**
 * Google Gemini provider implemented against the Generative Language REST API
 * (no extra SDK dependency). Uses responseMimeType=application/json so the
 * model returns a JSON object, mirroring OpenAI's json_object mode. The JSON
 * shape itself is described in the shared prompt built by VocabularyFetcher.
 */
export class GeminiProvider implements LLMProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = process.env.GEMINI_MODEL || 'gemini-2.0-flash') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateJSON(systemPrompt: string, userPrompt: string): Promise<string> {
    // Send the API key via the x-goog-api-key header rather than a `?key=`
    // query parameter so it does not leak into proxy / server access logs.
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new LLMError(`Gemini API error (${response.status}): ${errText}`);
      }

      const data = (await response.json()) as GeminiResponse;
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) {
        throw new LLMError('No content received from Gemini');
      }
      return content;
    } catch (error) {
      if (error instanceof LLMError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new LLMError(`Error fetching from Gemini: ${error.message}`);
      }
      throw new LLMError('Unknown error occurred while fetching from Gemini');
    }
  }
}
