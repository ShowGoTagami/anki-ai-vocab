import {
  createLLMProvider,
  createTTSProvider,
  getMissingLLMKeyMessage,
} from './providers';
import { OpenAIProvider } from './providers/llm/OpenAIProvider';
import { GeminiProvider } from './providers/llm/GeminiProvider';
import { PollyProvider } from './providers/tts/PollyProvider';
import { ElevenLabsProvider } from './providers/tts/ElevenLabsProvider';
import { Config, LLMError, TTSError } from '../types';

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    deck_name: 'English Vocabulary',
    model_name: 'Basic',
    openai_api_key: '',
    anki_host: 'localhost',
    anki_port: 8765,
    ai_provider: 'openai',
    gemini_api_key: '',
    tts_provider: 'polly',
    elevenlabs_api_key: '',
    ...overrides,
  };
}

describe('createLLMProvider', () => {
  it('builds an OpenAI provider when ai_provider=openai and a key is set', () => {
    const provider = createLLMProvider(makeConfig({ openai_api_key: 'sk-test' }));
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it('throws LLMError when OpenAI is selected but the key is missing', () => {
    expect(() => createLLMProvider(makeConfig({ ai_provider: 'openai' }))).toThrow(LLMError);
  });

  it('builds a Gemini provider when ai_provider=gemini and a key is set', () => {
    const provider = createLLMProvider(
      makeConfig({ ai_provider: 'gemini', gemini_api_key: 'gem-test' })
    );
    expect(provider).toBeInstanceOf(GeminiProvider);
  });

  it('throws LLMError when Gemini is selected but the key is missing', () => {
    expect(() => createLLMProvider(makeConfig({ ai_provider: 'gemini' }))).toThrow(LLMError);
  });
});

describe('createTTSProvider', () => {
  it('builds a Polly provider with no key required', () => {
    const provider = createTTSProvider(makeConfig({ tts_provider: 'polly' }));
    expect(provider).toBeInstanceOf(PollyProvider);
  });

  it('builds an ElevenLabs provider when selected and a key is set', () => {
    const provider = createTTSProvider(
      makeConfig({ tts_provider: 'elevenlabs', elevenlabs_api_key: 'el-test' })
    );
    expect(provider).toBeInstanceOf(ElevenLabsProvider);
  });

  it('throws TTSError when ElevenLabs is selected but the key is missing', () => {
    expect(() => createTTSProvider(makeConfig({ tts_provider: 'elevenlabs' }))).toThrow(TTSError);
  });
});

describe('getMissingLLMKeyMessage', () => {
  it('returns null when the OpenAI key is present', () => {
    expect(getMissingLLMKeyMessage(makeConfig({ openai_api_key: 'sk-test' }))).toBeNull();
  });

  it('mentions OpenAI when the OpenAI key is missing', () => {
    expect(getMissingLLMKeyMessage(makeConfig())).toContain('OpenAI');
  });

  it('returns null when the Gemini key is present', () => {
    expect(
      getMissingLLMKeyMessage(makeConfig({ ai_provider: 'gemini', gemini_api_key: 'g' }))
    ).toBeNull();
  });

  it('mentions Gemini when the Gemini key is missing', () => {
    expect(getMissingLLMKeyMessage(makeConfig({ ai_provider: 'gemini' }))).toContain('Gemini');
  });
});

describe('ElevenLabsProvider.generateAudio', () => {
  const realFetch = global.fetch;

  function mockFetchOk(): jest.Mock {
    const fn = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    });
    (global as unknown as { fetch: unknown }).fetch = fn;
    return fn;
  }

  afterEach(() => {
    (global as unknown as { fetch: unknown }).fetch = realFetch;
    jest.clearAllMocks();
  });

  it('returns an MP3 buffer on a successful response', async () => {
    mockFetchOk();
    const provider = new ElevenLabsProvider('el-key', 'voice-abc');
    const buffer = await provider.generateAudio('hello');
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBe(8);
  });

  it('ignores a Polly-style voice name and falls back to the configured voice id', async () => {
    const fetchMock = mockFetchOk();
    const provider = new ElevenLabsProvider('el-key', 'voice-abc');
    await provider.generateAudio('hello', { voice: 'Matthew' });

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/text-to-speech/voice-abc');
    expect(calledUrl).not.toContain('Matthew');
  });

  it('uses an explicit (non-Polly) voice id as-is', async () => {
    const fetchMock = mockFetchOk();
    const provider = new ElevenLabsProvider('el-key', 'voice-abc');
    await provider.generateAudio('hello', { voice: 'custom-voice-99' });

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/text-to-speech/custom-voice-99');
  });

  it('does not send any speed/rate field (1x by design)', async () => {
    const fetchMock = mockFetchOk();
    const provider = new ElevenLabsProvider('el-key', 'voice-abc');
    await provider.generateAudio('hello', { speed: 0.9 });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(body).toHaveProperty('text', 'hello');
    expect(body).toHaveProperty('model_id');
    expect(body).not.toHaveProperty('speed');
    expect(body).not.toHaveProperty('rate');
  });

  it('throws TTSError on a non-ok response', async () => {
    const fn = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'unauthorized',
    });
    (global as unknown as { fetch: unknown }).fetch = fn;

    const provider = new ElevenLabsProvider('el-key', 'voice-abc');
    await expect(provider.generateAudio('hello')).rejects.toBeInstanceOf(TTSError);
  });
});
