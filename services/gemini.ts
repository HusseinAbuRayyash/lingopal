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
  apiKey?: string
): Promise<AIResponseData> {
  if (!apiKey) {
    throw new Error("Missing Gemini API key");
  }
  const ai = getClient(apiKey);
  const modelId = "gemini-2.5-flash"; // Fast model for analysis
  
  const audioBase64 = await blobToBase64(audioBlob);
  
  // Construct history for context (Limited to last 3 for lower latency)
  const historyContext = history
    .slice(-3)
    .map(m => {
      if (m.sender === 'user' && m.transcript) return `User: ${m.transcript.transcript}`;
      if (m.sender === 'bot' && m.content) return `Bot: ${m.content.englishTranslation} (${m.content.targetText})`;
      return '';
    })
    .join('\n');

  const SYSTEM_PROMPT = `
    You are LingoPal, a friendly and fast language tutor teaching ${targetLanguage}.
    Teaching goal: ${goal}.
    Native mode: ${nativeMode ? 'ON (prefer natural, idiomatic phrasing and rhythm)' : 'OFF'}.
    Accent focus: ${accent}.
    
    Your Task:
    1. Listen to the user's input.
    2. **Detect Source Language:** Identify the user's spoken language (do not assume) and set 'sourceLanguage'.
    3. **Analyze for Mistakes:** Only check for errors if the user spoke ${targetLanguage} (including English). This includes grammar, vocabulary, structure, spelling, and **pronunciation** mistakes inferred from speech.
    4. **Conversational Reply:** Reply naturally in ${targetLanguage}. **KEEP IT SHORT (max 1-2 sentences).** Speed is key.
    5. **Structured Feedback:** If error, populate 'feedback'.
    6. **Vocabulary:** Extract 1 to 6 key terms depending on the content (can be 0 if none).

    Guidelines:
    - If user speaks a different language than ${targetLanguage}, reply in ${targetLanguage} with translation.
    - Vocabulary must include important phrases: proverbs, idioms, slang, cultural references, or named expressions.
    - For each vocabulary item, include 'sourceTerm' (the term in the source language) and provide short example sentences in both the source language ('exampleSource') and the target language ('exampleTarget').
    - Set hasError: false unless it's a clear mistake.
    - If pronunciation is wrong, set feedback.type = "pronunciation" and give a short, actionable tip.
    - Keep 'targetText' very concise.
    - 'culturalNotes': Max 1 brief note or empty if irrelevant.
    - For languages using Latin script, 'transliteration' can match 'targetText'.

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

export async function generateImageForTerm(term: string, meaning: string): Promise<string | null> {
  try {
    // Placeholder to reduce latency/cost for this demo.
    return `https://picsum.photos/seed/${encodeURIComponent(term)}/200`;
  } catch (e) {
    return null;
  }
}