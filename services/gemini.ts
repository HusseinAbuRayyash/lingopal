import { GoogleGenAI, Modality, Schema, Type } from "@google/genai";
import { AIResponseData, Message, TargetLanguage } from "../types";
import { blobToBase64 } from "../utils/audio";

const getClient = (apiKey: string) => new GoogleGenAI({ apiKey });

// Response Schema for analysis
const vocabularyItemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    term: { type: Type.STRING },
    transliteration: { type: Type.STRING },
    meaning: { type: Type.STRING },
    partOfSpeech: { type: Type.STRING },
    sourceTerm: { type: Type.STRING },
    exampleSource: { type: Type.STRING },
    exampleTarget: { type: Type.STRING },
    imageUrl: { type: Type.STRING },
  },
  required: ["term", "transliteration", "meaning", "partOfSpeech"],
};

const feedbackSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    hasError: { type: Type.BOOLEAN },
    type: { type: Type.STRING, enum: ['grammar', 'spelling', 'vocabulary', 'structure', 'pronunciation'] },
    correction: { type: Type.STRING },
    explanation: { type: Type.STRING },
  },
  required: ["hasError"],
};

const systemCommandSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    action: { type: Type.STRING, enum: ['SET_VOICE', 'SET_SPEED', 'OPEN_SETTINGS', 'CLOSE_SETTINGS'] },
    voiceValue: { type: Type.STRING },
    speedValue: { type: Type.NUMBER },
  },
  required: ["action"],
};

// Generalized Schema using targetText
const aiResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    userTranscript: { type: Type.STRING },
    userTransliteration: { type: Type.STRING },
    sourceLanguage: { type: Type.STRING },
    targetText: { type: Type.STRING }, // Generalized from arabicText
    transliteration: { type: Type.STRING },
    englishTranslation: { type: Type.STRING },
    vocabulary: { type: Type.ARRAY, items: vocabularyItemSchema },
    culturalNotes: { type: Type.ARRAY, items: { type: Type.STRING } },
    feedback: feedbackSchema,
    systemCommand: systemCommandSchema,
  },
  required: ["userTranscript", "targetText", "transliteration", "englishTranslation", "vocabulary", "culturalNotes"],
};

export async function analyzeAudioAndRespond(
  audioBlob: Blob,
  history: Message[] = [],
  targetLanguage: TargetLanguage = 'Arabic',
  goal: string = 'Casual',
  nativeMode: boolean = false,
  accent: string = 'Neutral',
  userName: string = '',
  apiKey?: string
): Promise<AIResponseData> {
  if (!apiKey) {
    throw new Error("Missing Gemini API key");
  }
  const ai = getClient(apiKey);
  const modelId = "gemini-2.5-flash"; // Fast model for analysis
  
  const audioBase64 = await blobToBase64(audioBlob);
  
  // Construct history for context (Limited to last 2 for lower latency)
  const historyContext = history
    .slice(-2)
    .map(m => {
      if (m.sender === 'user' && m.transcript) return `User: ${m.transcript.transcript}`;
      if (m.sender === 'bot' && m.content) return `Bot: ${m.content.englishTranslation} (${m.content.targetText})`;
      return '';
    })
    .join('\n');

  const trimmedName = userName.trim();
  const nameHint = trimmedName ? `Learner name: "${trimmedName}". Use it sparingly.` : 'No name provided.';
  const SYSTEM_PROMPT = `
    You are LingoPal, a friendly, fast tutor for ${targetLanguage}.
    Goal: ${goal}. Native mode: ${nativeMode ? 'ON' : 'OFF'}. Accent: ${accent}.
    ${nameHint}

    Tasks:
    - Transcribe to 'userTranscript' and detect 'sourceLanguage'.
    - If user spoke ${targetLanguage}, optionally add brief 'feedback' (only when clear mistakes).
    - Reply in ${targetLanguage}. If it's a question, answer naturally and add one short follow-up question (no labels like "Q:" or "A:").
    - Keep 'targetText' very short (1–2 sentences).
    - Vocabulary: 0–3 items max; examples optional and short if included.
    - culturalNotes: 0–1 short note.
    - Transliteration may match 'targetText' for Latin scripts.
    - If user asks to repeat, return only the last target phrase.

    Output MUST be valid JSON matching the schema.
  `;

  const fullPrompt = `
    ${SYSTEM_PROMPT}
    
    Conversation History:
    ${historyContext}
    
    (User just spoke. Transcribe, Analyze for Errors, and Respond)
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          { text: fullPrompt },
          {
            inlineData: {
              mimeType: audioBlob.type || 'audio/webm',
              data: audioBase64
            }
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: aiResponseSchema,
        temperature: 0.7,
      }
    });

    if (!response.text) {
      throw new Error("Empty response from Gemini");
    }

    const data = JSON.parse(response.text) as AIResponseData;
    return data;

  } catch (error) {
    console.error("Error analyzing audio:", error);
    throw error;
  }
}

export async function rephraseText(
  text: string,
  style: 'natural' | 'casual' | 'formal',
  targetLanguage: TargetLanguage,
  goal: string,
  nativeMode: boolean,
  accent: string,
  apiKey?: string
): Promise<AIResponseData> {
  if (!apiKey) {
    throw new Error("Missing Gemini API key");
  }
  const ai = getClient(apiKey);
  const modelId = "gemini-2.5-flash";

  const prompt = `
    You are a language coach. Rephrase the given text in ${targetLanguage}.
    Style: ${style}. Teaching goal: ${goal}. Native mode: ${nativeMode ? 'ON' : 'OFF'}. Accent: ${accent}.

    Instructions:
    - Keep the meaning the same.
    - Keep it short (1-2 sentences).
    - If native mode is ON, prefer natural, idiomatic phrasing.
    - Provide transliteration if needed.
    - Provide englishTranslation (if target language is English, repeat the rephrased text).
    - Set vocabulary to [] and culturalNotes to [].
    - Set userTranscript to the original input text.

    Output valid JSON matching the schema.
  `;

  const response = await ai.models.generateContent({
    model: modelId,
    contents: {
      parts: [{ text: `${prompt}\n\nText: ${text}` }]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: aiResponseSchema,
      temperature: 0.7
    }
  });

  if (!response.text) {
    throw new Error("Empty response from Gemini");
  }

  return JSON.parse(response.text) as AIResponseData;
}

export async function generateSpeech(
  text: string,
  voiceName: string = 'Zephyr',
  apiKey?: string
): Promise<string> {
  if (!apiKey) {
    throw new Error("Missing Gemini API key");
  }
  const ai = getClient(apiKey);
  const modelId = "gemini-2.5-flash-preview-tts";

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [{ text }]
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName }
          }
        }
      }
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) {
      throw new Error("No audio data returned");
    }
    
    return audioData;

  } catch (error) {
    console.error("Error generating speech:", error);
    throw error;
  }
}

export async function generateImageForTerm(term: string, _meaning: string): Promise<string | null> {
  try {
    // Placeholder to reduce latency/cost for this demo.
    return `https://picsum.photos/seed/${encodeURIComponent(term)}/200`;
  } catch (e) {
    return null;
  }
}