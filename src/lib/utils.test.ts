import * as fs from 'fs';
import { parseJapaneseMeanings, loadConfig, createAnkiFields } from './utils';
import { AnkiAudioFile, ExpressionInfo } from '../types';

jest.mock('fs');
const mockedExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;

describe('parseJapaneseMeanings', () => {
  it('returns an empty array for empty / whitespace-only input', () => {
    expect(parseJapaneseMeanings('')).toEqual([]);
    expect(parseJapaneseMeanings('   ')).toEqual([]);
    // @ts-expect-error - exercising the runtime null guard
    expect(parseJapaneseMeanings(undefined)).toEqual([]);
  });

  it('splits a single meaning', () => {
    expect(parseJapaneseMeanings('参加する')).toEqual(['参加する']);
  });

  it('splits multiple comma-separated meanings', () => {
    expect(parseJapaneseMeanings('洗練された,上品な')).toEqual(['洗練された', '上品な']);
  });

  it('trims surrounding whitespace from each meaning', () => {
    expect(parseJapaneseMeanings('  洗練された ,  上品な  ')).toEqual(['洗練された', '上品な']);
  });

  it('drops empty segments produced by stray commas', () => {
    expect(parseJapaneseMeanings('a, , b,')).toEqual(['a', 'b']);
  });
});

describe('loadConfig', () => {
  const ORIGINAL_ENV = process.env;
  const PROVIDER_KEYS = [
    'DECK_NAME',
    'MODEL_NAME',
    'OPENAI_API_KEY',
    'ANKI_HOST',
    'ANKI_PORT',
    'AI_PROVIDER',
    'GEMINI_API_KEY',
    'TTS_PROVIDER',
    'ELEVENLABS_API_KEY',
    'ELEVENLABS_VOICE_ID',
  ];

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    PROVIDER_KEYS.forEach((key) => delete process.env[key]);
    // Pretend there is no on-disk config file so we exercise the env/default path.
    mockedExistsSync.mockReturnValue(false);
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.clearAllMocks();
  });

  it('falls back to documented defaults when nothing is set', () => {
    const config = loadConfig();
    expect(config).toMatchObject({
      deck_name: 'English Vocabulary',
      model_name: 'Basic (and reversed card)',
      openai_api_key: '',
      anki_host: 'localhost',
      anki_port: 8765,
    });
  });

  it('reads overrides from environment variables', () => {
    process.env.DECK_NAME = 'My Deck';
    process.env.MODEL_NAME = 'Basic';
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.ANKI_HOST = 'anki.local';
    process.env.ANKI_PORT = '9999';

    const config = loadConfig();
    expect(config).toMatchObject({
      deck_name: 'My Deck',
      model_name: 'Basic',
      openai_api_key: 'sk-test',
      anki_host: 'anki.local',
      anki_port: 9999,
    });
  });

  it('parses ANKI_PORT as a number', () => {
    process.env.ANKI_PORT = '1234';
    expect(loadConfig().anki_port).toBe(1234);
    expect(typeof loadConfig().anki_port).toBe('number');
  });

  it('defaults to the openai / polly providers', () => {
    const config = loadConfig();
    expect(config).toMatchObject({
      ai_provider: 'openai',
      tts_provider: 'polly',
      gemini_api_key: '',
      elevenlabs_api_key: '',
    });
    expect(config.elevenlabs_voice_id).toBeUndefined();
  });

  it('selects gemini / elevenlabs providers and keys from env', () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'gem-test';
    process.env.TTS_PROVIDER = 'elevenlabs';
    process.env.ELEVENLABS_API_KEY = 'el-test';
    process.env.ELEVENLABS_VOICE_ID = 'voice-123';

    const config = loadConfig();
    expect(config).toMatchObject({
      ai_provider: 'gemini',
      gemini_api_key: 'gem-test',
      tts_provider: 'elevenlabs',
      elevenlabs_api_key: 'el-test',
      elevenlabs_voice_id: 'voice-123',
    });
  });

  it('ignores unknown provider names and falls back to defaults', () => {
    process.env.AI_PROVIDER = 'bogus';
    process.env.TTS_PROVIDER = 'nonsense';

    const config = loadConfig();
    expect(config.ai_provider).toBe('openai');
    expect(config.tts_provider).toBe('polly');
  });
});

describe('createAnkiFields', () => {
  const baseInfo: ExpressionInfo = {
    japanese_meaning: ['洗練された', '上品な'],
    english_meaning: ['[adjective] refined and cultured'],
    ipa: '/səˈfɪstɪkeɪtɪd/',
    idiom: 'N/A',
    example_sentence: ['She has a sophisticated taste in art.'],
    similar_expressions: 'N/A',
    derivatives: 'N/A',
  };

  it('maps content to front/back fields detected by name', () => {
    const fields = createAnkiFields('sophisticated', baseInfo, ['Front', 'Back']);

    expect(Object.keys(fields)).toEqual(['Front', 'Back']);
    // Front holds the expression + IPA
    expect(fields.Front).toContain('sophisticated');
    expect(fields.Front).toContain('/səˈfɪstɪkeɪtɪd/');
    // Back holds meanings + example + japanese
    expect(fields.Back).toContain('[adjective] refined and cultured');
    expect(fields.Back).toContain('She has a sophisticated taste in art.');
    expect(fields.Back).toContain('洗練された');
    expect(fields.Back).toContain('上品な');
  });

  it('detects front/back from Word/Meaning style field names', () => {
    const fields = createAnkiFields('sophisticated', baseInfo, ['Word', 'Meaning']);
    expect(fields.Word).toContain('sophisticated');
    expect(fields.Meaning).toContain('[adjective] refined and cultured');
  });

  it('concatenates front and back for a single-field note type', () => {
    const fields = createAnkiFields('sophisticated', baseInfo, ['Text']);
    expect(Object.keys(fields)).toEqual(['Text']);
    expect(fields.Text).toContain('sophisticated');
    expect(fields.Text).toContain('[adjective] refined and cultured');
    expect(fields.Text).toContain('洗練された');
  });

  it('omits N/A sections (idiom / derivatives / similar expressions)', () => {
    const fields = createAnkiFields('sophisticated', baseInfo, ['Front', 'Back']);
    expect(fields.Back).not.toContain('Idiom/Phrase');
    expect(fields.Back).not.toContain('Derivatives');
    expect(fields.Back).not.toContain('Similar Expressions');
  });

  it('renders idiom, derivatives and similar expressions when present', () => {
    const richInfo: ExpressionInfo = {
      ...baseInfo,
      idiom: [{ english: 'a piece of cake', japanese: '朝飯前' }],
      derivatives: [
        {
          word: 'sophistication',
          part_of_speech: 'noun',
          meaning: 'the quality of being sophisticated',
          japanese_meaning: '洗練',
        },
      ],
      similar_expressions: [
        {
          expression: 'refined',
          difference: 'emphasises polish',
          difference_japanese: '上品さを強調',
        },
      ],
    };

    const fields = createAnkiFields('sophisticated', richInfo, ['Front', 'Back']);
    expect(fields.Back).toContain('Idiom/Phrase');
    expect(fields.Back).toContain('a piece of cake');
    expect(fields.Back).toContain('朝飯前');
    expect(fields.Back).toContain('Derivatives');
    expect(fields.Back).toContain('sophistication');
    expect(fields.Back).toContain('Similar Expressions');
    expect(fields.Back).toContain('refined');
  });

  it('embeds [sound:] tags for matching expression and example audio files', () => {
    const audioFiles: AnkiAudioFile[] = [
      { filename: 'expression_sophisticated.mp3', data: 'AAAA', fields: ['Front'] },
      { filename: 'example_sophisticated_1.mp3', data: 'BBBB', fields: ['Back'] },
    ];

    const fields = createAnkiFields('sophisticated', baseInfo, ['Front', 'Back'], audioFiles);
    expect(fields.Front).toContain('[sound:expression_sophisticated.mp3]');
    expect(fields.Back).toContain('[sound:example_sophisticated_1.mp3]');
  });

  it('uses a safe filename (spaces replaced) when matching audio for phrases', () => {
    const audioFiles: AnkiAudioFile[] = [
      { filename: 'expression_participate_in.mp3', data: 'AAAA', fields: ['Front'] },
    ];

    const fields = createAnkiFields('participate in', baseInfo, ['Front', 'Back'], audioFiles);
    expect(fields.Front).toContain('participate in');
    expect(fields.Front).toContain('[sound:expression_participate_in.mp3]');
  });
});
