export enum Sender {
  User = 'user',
  Bot = 'bot'
}

export type TargetLanguage =
  | 'Arabic'
  | 'Spanish'
  | 'French'
  | 'German'
  | 'English'
  | 'Chinese'
  | 'Japanese'
  | 'Latin'
  | 'Russian';

export interface VocabularyItem {
  term: string;             // Word or phrase in target language
  transliteration: string;  // Latin transliteration (mostly for Arabic)
  meaning: string;          // English gloss
  partOfSpeech: string;     // e.g. noun, verb, adjective
  sourceTerm?: string;      // The term in the detected source language
  exampleSource?: string;   // Example sentence in detected source language
  exampleTarget?: string;   // Example sentence in target language
  imageUrl?: string;        // optional URL to an illustrative icon/image
}

export interface Feedback {
  hasError: boolean;
  type?: 'grammar' | 'spelling' | 'vocabulary' | 'structure' | 'pronunciation';
  correction?: string;      // The corrected phrase
  explanation?: string;     // Brief explanation
}

export interface SystemCommand {
  action: 'SET_VOICE' | 'SET_SPEED' | 'OPEN_SETTINGS' | 'CLOSE_SETTINGS';
  voiceValue?: string;      // voice name
  speedValue?: number;      // playback speed
}

export interface AIResponseData {
  userTranscript: string;           // exact transcription of the user’s speech
  userTransliteration?: string;     // transliteration if the user spoke the target language
  sourceLanguage?: string;          // detected user spoken language (human-readable)
  rephraseStyle?: RephraseStyle;    // optional label for rephrased responses
  targetText: string;               // main response in Target Language (was arabicText)
  transliteration: string;          // transliteration (optional for latin languages)
  englishTranslation: string;       // English translation of the AI’s response
  vocabulary: VocabularyItem[];     // list of key words/phrases
  culturalNotes: string[];          // short bullet-style strings
  feedback?: Feedback;              // Optional correction/feedback
  systemCommand?: SystemCommand;    // optional system instruction
}

export interface Message {
  id: string;
  sender: Sender;
  timestamp: number;
  // For user messages:
  transcript?: {
    transcript: string;
    transliteration?: string;
  };
  // For bot messages:
  content?: AIResponseData;
  audioUrl?: string;    // blob URL for synthesized speech
  audioBuffer?: AudioBuffer; // Decoded buffer for re-use
  playbackRateOverride?: number;
  isPlaying?: boolean;
}

export interface AppSettings {
  targetLanguage: TargetLanguage; // The language being learned
  voiceName: string;      // TTS voice identifier
  speechSpeed: number;    // numeric speed multiplier
  apiKey: string;
  userName: string;
  goal: LearningGoal;
  nativeMode: boolean;
  paceMatch: boolean;
  shadowMode: boolean;
  micCues: boolean;
  noiseGuard: boolean;
  accent: AccentPreset;
}

export const AVAILABLE_VOICES = ["Zephyr", "Puck", "Charon", "Kore", "Fenrir"];
export const AVAILABLE_LANGUAGES: TargetLanguage[] = [
  'Arabic',
  'Spanish',
  'French',
  'German',
  'English',
  'Chinese',
  'Japanese',
  'Latin',
  'Russian'
];
export type LearningGoal = 'Travel' | 'Business' | 'Casual' | 'Exam Prep' | 'Culture';
export const AVAILABLE_GOALS: LearningGoal[] = ['Travel', 'Business', 'Casual', 'Exam Prep', 'Culture'];
export type RephraseStyle = 'natural' | 'casual' | 'formal';
export type AccentPreset =
  | 'Neutral'
  | 'American'
  | 'British'
  | 'Castilian Spanish'
  | 'Mexican Spanish'
  | 'Argentine Spanish'
  | 'Colombian Spanish'
  | 'Mandarin (Mainland)'
  | 'Mandarin (Taiwan)'
  | 'Cantonese'
  | 'Gulf Arabic'
  | 'Levantine Arabic'
  | 'Egyptian Arabic';
export const AVAILABLE_ACCENTS: AccentPreset[] = [
  'Neutral',
  'American',
  'British',
  'Castilian Spanish',
  'Mexican Spanish',
  'Argentine Spanish',
  'Colombian Spanish',
  'Mandarin (Mainland)',
  'Mandarin (Taiwan)',
  'Cantonese',
  'Gulf Arabic',
  'Levantine Arabic',
  'Egyptian Arabic'
];