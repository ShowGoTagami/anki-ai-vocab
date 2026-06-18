import { TTSProvider } from './TTSProvider';
import { AudioGenerationOptions, TTSError } from '../../../types';

// Default public ElevenLabs voice ("Rachel"). Used when no voice id is
// configured and the CLI is still passing a Polly-style voice name.
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

// Known Amazon Polly voice names. When ElevenLabs is the selected provider but
// the CLI still passes its Polly default (e.g. --voice "Matthew"), we ignore it
// and fall back to the configured ElevenLabs voice id instead of sending a
// Polly name as a (non-existent) ElevenLabs voice id.
const POLLY_VOICE_NAMES = new Set([
  'Matthew',
  'Joanna',
  'Amy',
  'Brian',
  'Mizuki',
  'Takumi',
  'Joey',
  'Kendra',
  'Kimberly',
  'Salli',
  'Justin',
  'Ivy',
  'Emma',
  'Russell',
  'Nicole',
]);

/**
 * ElevenLabs text-to-speech provider (REST API, no extra SDK dependency).
 *
 * NOTE on speed: ElevenLabs does not support SSML <prosody rate>. Per the
 * chosen design, the `speed` option is intentionally ignored and audio is
 * generated at the model's natural 1x rate.
 */
export class ElevenLabsProvider implements TTSProvider {
  private apiKey: string;
  private defaultVoiceId: string;
  private modelId: string;

  constructor(
    apiKey: string,
    defaultVoiceId: string = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID,
    modelId: string = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2'
  ) {
    this.apiKey = apiKey;
    this.defaultVoiceId = defaultVoiceId || DEFAULT_VOICE_ID;
    this.modelId = modelId;
  }

  async generateAudio(text: string, options: AudioGenerationOptions = {}): Promise<Buffer> {
    // Speed is intentionally not applied (see class doc).
    const requested = options.voice;
    const voiceId =
      requested && !POLLY_VOICE_NAMES.has(requested) ? requested : this.defaultVoiceId;

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: this.modelId,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new TTSError(`ElevenLabs API error (${response.status}): ${errText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      if (error instanceof TTSError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new TTSError(`Error generating audio with ElevenLabs: ${error.message}`);
      }
      throw new TTSError('Unknown error occurred while generating audio with ElevenLabs');
    }
  }
}
