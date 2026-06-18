import {
  AudioGenerationOptions,
  AudioGenerationResult,
  ExampleAudio,
  LLMError,
  TTSError,
  ExpressionInfo,
  Config,
} from "../types";
import {
  createLLMProvider,
  createTTSProvider,
  LLMProvider,
  TTSProvider,
} from "./providers";

export class VocabularyFetcher {
  private config: Config;
  private _llm?: LLMProvider;
  private _tts?: TTSProvider;

  constructor(config: Config) {
    this.config = config;
  }

  // Providers are created lazily so that, for example, `--no-audio` never
  // requires a TTS API key, and a Gemini user never needs an OpenAI key.
  private get llm(): LLMProvider {
    if (!this._llm) {
      this._llm = createLLMProvider(this.config);
    }
    return this._llm;
  }

  private get tts(): TTSProvider {
    if (!this._tts) {
      this._tts = createTTSProvider(this.config);
    }
    return this._tts;
  }

  async getExpressionInfo(expression: string): Promise<ExpressionInfo> {
    const prompt = `
        Please provide the following information for the English expression "${expression}":
        1. Japanese meaning (日本語の意味、複数可、頻出順に)
        2. English definition (英語の定義、複数可、頻出順に)
           CRITICAL: Each English definition MUST start with the part of speech in square brackets.
           Format: "[part of speech] definition"
           Examples:
           - "[verb] to organize and carry out"
           - "[noun] a piece of furniture"
           - "[adjective] having great size"
        3. IPA pronunciation
        4. Common idioms or phrases with Japanese translations (if any, otherwise write "N/A")
           Format as an array of objects with "english" and "japanese" keys
        5. Example sentences (at least one, if possible 2-3, otherwise write "N/A")
        6. Similar expressions and their differences (類似表現とその違い)
           Provide 2-3 expressions that are similar in meaning but have nuanced differences.
           Format as an array of objects with "expression", "difference" (in English), and "difference_japanese" keys.
           Example: [{"expression": "big", "difference": "more general term for large size", "difference_japanese": "サイズが大きいことを表す一般的な言葉"}]
           If no similar expressions exist, write "N/A"
        7. Derivatives (派生語)
           Provide related words derived from the same root or family as the expression.
           Format as an array of objects with "word", "part_of_speech", "meaning", and "japanese_meaning" keys.
           Example: [{"word": "comfortable", "part_of_speech": "adjective", "meaning": "providing physical ease", "japanese_meaning": "快適な"}]
           If no derivatives exist, write "N/A"

        Format the response as JSON with these exact keys:
        - japanese_meaning (array of strings)
        - english_meaning (array of strings, EACH MUST START WITH [part of speech])
        - ipa (string)
        - idiom (array of objects with "english" and "japanese" keys, or "N/A" if none)
        - example_sentence (array of strings)
        - similar_expressions (array of objects with "expression", "difference", and "difference_japanese" keys, or "N/A" if none)
        - derivatives (array of objects with "word", "part_of_speech", "meaning", and "japanese_meaning" keys, or "N/A" if none)

        Remember: Every item in english_meaning MUST begin with [noun], [verb], [adjective], [adverb], etc.
        `;

    const systemPrompt =
      "You are a helpful language teacher providing vocabulary information in JSON format. Always include parts of speech in square brackets [noun], [verb], [adjective], etc. at the beginning of each English definition.";

    try {
      const content = await this.llm.generateJSON(systemPrompt, prompt);

      const data = JSON.parse(content) as ExpressionInfo;

      // Ensure english_meaning entries have parts of speech
      if (data.english_meaning && Array.isArray(data.english_meaning)) {
        data.english_meaning = this.processEnglishMeanings(
          data.english_meaning
        );
      }

      return data;
    } catch (error) {
      if (error instanceof LLMError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new LLMError(
          `Error fetching expression information: ${error.message}`
        );
      }
      throw new LLMError(
        "Unknown error occurred while fetching expression information"
      );
    }
  }

  async getExpressionInfoWithSpecificMeanings(
    expression: string,
    japaneseMeanings: string[]
  ): Promise<ExpressionInfo> {
    const japaneseMeaningsStr = japaneseMeanings.join(", ");

    const prompt = `
        Please provide the following information for the English expression "${expression}" ONLY for these specific Japanese meanings: ${japaneseMeaningsStr}

        IMPORTANT CONSTRAINTS:
        1. Japanese meaning: Use ONLY the provided meanings: ${japaneseMeaningsStr}
        2. English definition: Provide ONLY English definitions that correspond to the specified Japanese meanings
           CRITICAL: Each English definition MUST start with the part of speech in square brackets.
           Format: "[part of speech] definition"
        3. IPA pronunciation (same as usual)
        4. Idioms: Skip idioms completely (return "N/A")
        5. Example sentences: Provide ONLY example sentences that use the expression in the context of the specified Japanese meanings
        6. Similar expressions: Provide ONLY expressions that are similar when used in the context of the specified Japanese meanings
           Format as an array of objects with "expression", "difference" (in English), and "difference_japanese" keys.
        7. Derivatives: Provide derivatives ONLY if they relate to the specified Japanese meanings
           Format as an array of objects with "word", "part_of_speech", "meaning", and "japanese_meaning" keys.

        Format the response as JSON with these exact keys:
        - japanese_meaning (array of strings - use ONLY the provided meanings)
        - english_meaning (array of strings, EACH MUST START WITH [part of speech])
        - ipa (string)
        - idiom (always "N/A")
        - example_sentence (array of strings - only for the specified meanings)
        - similar_expressions (array of objects with "expression", "difference", and "difference_japanese" keys, or "N/A" if none)
        - derivatives (array of objects with "word", "part_of_speech", "meaning", and "japanese_meaning" keys, or "N/A" if none)

        Remember:
        - Every item in english_meaning MUST begin with [noun], [verb], [adjective], [adverb], etc.
        - Only include content relevant to the specified Japanese meanings: ${japaneseMeaningsStr}
        `;

    const systemPrompt =
      "You are a helpful language teacher providing vocabulary information in JSON format for specific meanings only. Always include parts of speech in square brackets [noun], [verb], [adjective], etc. at the beginning of each English definition. Only provide information relevant to the specified Japanese meanings.";

    try {
      const content = await this.llm.generateJSON(systemPrompt, prompt);

      const data = JSON.parse(content) as ExpressionInfo;

      // Ensure japanese_meaning uses only the specified meanings
      data.japanese_meaning = japaneseMeanings;

      // Ensure english_meaning entries have parts of speech
      if (data.english_meaning && Array.isArray(data.english_meaning)) {
        data.english_meaning = this.processEnglishMeanings(
          data.english_meaning
        );
      }

      // Ensure idiom is always "N/A"
      data.idiom = "N/A";

      return data;
    } catch (error) {
      if (error instanceof LLMError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new LLMError(
          `Error fetching expression information with specific meanings: ${error.message}`
        );
      }
      throw new LLMError(
        "Unknown error occurred while fetching expression information"
      );
    }
  }

  private processEnglishMeanings(meanings: string[]): string[] {
    return meanings.map((meaning) => {
      // Check if it already has a part of speech tag
      if (meaning.startsWith("[")) {
        return meaning;
      }

      // Try to infer part of speech from the definition
      const meaningLower = meaning.toLowerCase();

      if (meaningLower.startsWith("to ") || meaningLower.startsWith("to be ")) {
        return `[verb] ${meaning}`;
      } else if (
        meaningLower.startsWith("a ") ||
        meaningLower.startsWith("an ") ||
        meaningLower.startsWith("the ")
      ) {
        return `[noun] ${meaning}`;
      } else if (
        [
          "having ",
          "being ",
          "showing ",
          "causing ",
          "pleasing ",
          "making ",
        ].some((w) => meaningLower.startsWith(w))
      ) {
        return `[adjective] ${meaning}`;
      } else if (
        [" act of ", " process of ", " state of ", " quality of "].some((w) =>
          meaningLower.includes(w)
        )
      ) {
        return `[noun] ${meaning}`;
      } else if (meaningLower.split(" ").pop()?.endsWith("ly")) {
        return `[adverb] ${meaning}`;
      } else {
        // For single expression, it's often an adjective
        if (
          meaning.split(" ").length <= 5 &&
          !meaning.includes(".") &&
          !meaning.includes(",") &&
          !meaning.includes(":") &&
          !meaning.includes(";")
        ) {
          return `[adjective] ${meaning}`;
        } else {
          return `[definition] ${meaning}`;
        }
      }
    });
  }

  async generateAudio(
    text: string,
    options: AudioGenerationOptions = {}
  ): Promise<Buffer> {
    return this.tts.generateAudio(text, options);
  }

  async generateAudioFiles(
    expression: string,
    exampleSentences: string | string[],
    voice: string = "Matthew"
  ): Promise<AudioGenerationResult> {
    try {
      // Generate audio for the expression (slower speed for clarity)
      const expressionAudioBuffer = await this.generateAudio(expression, {
        voice,
        speed: 0.9,
      });
      const expressionAudio = expressionAudioBuffer.toString("base64");

      // Generate audio for each example sentence separately
      const exampleAudios: ExampleAudio[] = [];

      // Handle both string and list input
      let sentences: string[] = [];
      if (typeof exampleSentences === "string") {
        if (exampleSentences.trim() && exampleSentences.trim() !== "N/A") {
          sentences = [exampleSentences.trim()];
        }
      } else if (Array.isArray(exampleSentences)) {
        sentences = exampleSentences.filter(
          (s) => s.trim() && s.trim() !== "N/A"
        );
      }

      // Generate audio for each sentence
      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        if (sentence) {
          const exampleAudioBuffer = await this.generateAudio(sentence, {
            voice,
            speed: 0.9,
          });
          const exampleAudio = exampleAudioBuffer.toString("base64");
          exampleAudios.push({
            index: i,
            sentence,
            audio: exampleAudio,
          });
        }
      }

      return {
        expressionAudio,
        exampleAudios,
      };
    } catch (error) {
      if (error instanceof TTSError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new TTSError(`Error generating audio files: ${error.message}`);
      }
      throw new TTSError("Unknown error occurred while generating audio files");
    }
  }
}
