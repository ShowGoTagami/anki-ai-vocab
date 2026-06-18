import { Config, LLMError, TTSError } from '../../types';
import { LLMProvider } from './llm/LLMProvider';
import { OpenAIProvider } from './llm/OpenAIProvider';
import { GeminiProvider } from './llm/GeminiProvider';
import { TTSProvider } from './tts/TTSProvider';
import { PollyProvider } from './tts/PollyProvider';
import { ElevenLabsProvider } from './tts/ElevenLabsProvider';

export { LLMProvider } from './llm/LLMProvider';
export { TTSProvider } from './tts/TTSProvider';

/**
 * Build the configured text-generation provider. Throws LLMError with a
 * user-friendly message when the required API key is missing.
 */
export function createLLMProvider(config: Config): LLMProvider {
  switch (config.ai_provider) {
    case 'gemini':
      if (!config.gemini_api_key) {
        throw new LLMError(
          'Gemini API key not found. Please set GEMINI_API_KEY environment variable or add it to config.'
        );
      }
      return new GeminiProvider(config.gemini_api_key);
    case 'openai':
    default:
      if (!config.openai_api_key) {
        throw new LLMError(
          'OpenAI API key not found. Please set OPENAI_API_KEY environment variable or add it to config.'
        );
      }
      return new OpenAIProvider(config.openai_api_key);
  }
}

/**
 * Build the configured text-to-speech provider. Throws TTSError with a
 * user-friendly message when the required API key is missing.
 */
export function createTTSProvider(config: Config): TTSProvider {
  switch (config.tts_provider) {
    case 'elevenlabs':
      if (!config.elevenlabs_api_key) {
        throw new TTSError(
          'ElevenLabs API key not found. Please set ELEVENLABS_API_KEY environment variable or add it to config.'
        );
      }
      return new ElevenLabsProvider(config.elevenlabs_api_key, config.elevenlabs_voice_id);
    case 'polly':
    default:
      return new PollyProvider();
  }
}

/**
 * Return a user-friendly error message if the API key for the selected LLM
 * provider is missing, otherwise null. Used by entry points to fail early with
 * a clear message before any processing starts.
 */
export function getMissingLLMKeyMessage(config: Config): string | null {
  if (config.ai_provider === 'gemini') {
    return config.gemini_api_key
      ? null
      : 'Error: Gemini API key not found. Please set GEMINI_API_KEY environment variable or add it to config.';
  }
  return config.openai_api_key
    ? null
    : 'Error: OpenAI API key not found. Please set OPENAI_API_KEY environment variable or add it to config.';
}
