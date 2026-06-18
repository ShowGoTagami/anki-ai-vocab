import { AudioGenerationOptions } from '../../../types';

/**
 * Provider-agnostic interface for text-to-speech generation.
 *
 * Implementations take text plus options (voice/speed) and return raw MP3
 * audio as a Buffer. Base64 encoding and per-sentence orchestration stay in
 * VocabularyFetcher so they are shared across every provider.
 */
export interface TTSProvider {
  generateAudio(text: string, options?: AudioGenerationOptions): Promise<Buffer>;
}
