import {
  Engine,
  OutputFormat,
  PollyClient,
  SynthesizeSpeechCommand,
  VoiceId,
} from '@aws-sdk/client-polly';
import { TTSProvider } from './TTSProvider';
import { AudioGenerationOptions, TTSError } from '../../../types';

export class PollyProvider implements TTSProvider {
  private client: PollyClient;

  constructor() {
    this.client = new PollyClient({
      region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }

  async generateAudio(text: string, options: AudioGenerationOptions = {}): Promise<Buffer> {
    const { voice = 'Matthew', speed = 1.0 } = options;

    try {
      // Map speed to Polly's rate parameter (percentage). Polly: 20%-200%.
      const pollyRate = Math.round(speed * 100);

      // Wrap text in SSML for speed control
      const ssmlText = `<speak><prosody rate="${pollyRate}%">${text}</prosody></speak>`;

      const command = new SynthesizeSpeechCommand({
        Text: ssmlText,
        TextType: 'ssml',
        OutputFormat: OutputFormat.MP3,
        VoiceId: voice as VoiceId,
        Engine: Engine.NEURAL,
      });

      const response = await this.client.send(command);

      if (!response.AudioStream) {
        throw new TTSError('No audio stream received from Polly');
      }

      // Convert stream to buffer for Node.js environment
      const chunks: Buffer[] = [];
      const stream = response.AudioStream as NodeJS.ReadableStream;

      return new Promise<Buffer>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        stream.on('end', () => {
          resolve(Buffer.concat(chunks));
        });

        stream.on('error', (error) => {
          reject(error);
        });
      });
    } catch (error) {
      if (error instanceof TTSError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new TTSError(`Error generating audio with Polly: ${error.message}`);
      }
      throw new TTSError('Unknown error occurred while generating audio with Polly');
    }
  }
}
