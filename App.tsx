import { useState, useRef, useEffect } from 'react';
import { Message, AppSettings, Sender, AIResponseData, VocabularyItem } from './types';
import { analyzeAudioAndRespond, generateSpeech } from './services/gemini';
import { decodeAudioData } from './utils/audio';
import ChatInterface from './components/ChatInterface';
import RecordButton from './components/RecordButton';
import SettingsModal from './components/SettingsModal';
import { Settings, Sparkles, AlertTriangle, Download } from 'lucide-react';

function App() {
  // --- State ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const defaultSettings: AppSettings = {
    targetLanguage: 'Arabic',
    voiceName: 'Zephyr',
    speechSpeed: 1.0,
    apiKey: '',
    userName: '',
    goal: 'Casual',
    nativeMode: false,
    paceMatch: false,
    shadowMode: false,
    micCues: true,
    noiseGuard: true,
    accent: 'Neutral'
  };
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem('alRafiqSettings');
      if (!stored) return defaultSettings;
      const parsed = JSON.parse(stored) as Partial<AppSettings>;
      return { ...defaultSettings, ...parsed };
    } catch (e) {
      return defaultSettings;
    }
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [volumeLevel, setVolumeLevel] = useState<number>(0);
  const [audioUnlockRequired, setAudioUnlockRequired] = useState(false);
  const humorPhrases = [
    "Your brain is buffering — totally normal.",
    "Close enough to fool a tourist — almost.",
    "That one had potential. We'll give it a remix.",
    "If language were coffee, you're at a solid espresso."
  ];
  const getRandom = (items: string[]) => items[Math.floor(Math.random() * items.length)];

  // --- Refs ---
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const pendingAutoPlayQueueRef = useRef<string[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const settingsRef = useRef<AppSettings>(defaultSettings);
  const isRecordingRef = useRef(false);
  const isLoadingRef = useRef(false);
  const shadowStartTimeoutRef = useRef<number | null>(null);
  const vocabAudioCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const ttsQuotaExceededRef = useRef(false);
  
  // VAD Refs
  const vadIntervalRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const noiseFloorRef = useRef<number | null>(null);
  const recordingStartRef = useRef<number | null>(null);

  // --- Initialization ---
  useEffect(() => {
    return () => {
      audioContextRef.current?.close();
      if (vadIntervalRef.current) clearInterval(vadIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('alRafiqSettings', JSON.stringify(settings));
    } catch (e) {
      // Ignore storage failures (private mode, etc.)
    }
  }, [settings]);

  useEffect(() => {
    const handleUserGesture = async () => {
      const unlocked = await unlockAudioContext();
      if (!unlocked) {
        setAudioUnlockRequired(true);
      }
      tryPlayPending();
    };
    window.addEventListener('pointerdown', handleUserGesture);
    window.addEventListener('keydown', handleUserGesture);
    return () => {
      window.removeEventListener('pointerdown', handleUserGesture);
      window.removeEventListener('keydown', handleUserGesture);
    };
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);
  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);
  useEffect(() => {
    if (!settings.shadowMode && shadowStartTimeoutRef.current) {
      clearTimeout(shadowStartTimeoutRef.current);
      shadowStartTimeoutRef.current = null;
    }
  }, [settings.shadowMode]);

  const envApiKey =
    import.meta.env.VITE_GEMINI_API_KEY ||
    import.meta.env.VITE_API_KEY;
  const apiKey = settings.apiKey.trim() || envApiKey;
  const apiKeyMissing = !apiKey;

  const ensureAudioContext = () => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioCtx();
    }
    return audioContextRef.current;
  };

  const playBeep = (frequency: number, durationMs: number) => {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
    osc.start(now);
    osc.stop(now + durationMs / 1000);
  };

  const unlockAudioContext = async (): Promise<boolean> => {
    const ctx = ensureAudioContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (e) {
        console.warn("Failed to resume AudioContext:", e);
        return false;
      }
    }
    // Play a near-silent tick to unlock autoplay on some browsers and wait for it.
    return new Promise<boolean>((resolve) => {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 30;
        gain.gain.value = 0.0001;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const now = ctx.currentTime;
        osc.onended = () => resolve(true);
        osc.start(now);
        osc.stop(now + 0.02);
        // Fallback in case onended doesn't fire
        setTimeout(() => resolve(ctx.state === 'running'), 100);
      } catch (e) {
        console.warn("Audio unlock failed:", e);
        resolve(false);
      }
    });
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const isQuotaError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes("RESOURCE_EXHAUSTED") || message.toLowerCase().includes("quota");
  };

  const speakWithBrowser = async (text: string, msgId?: string, rateOverride?: number) => {
    if (!('speechSynthesis' in window)) return false;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rateOverride ?? settings.speechSpeed;
      if (msgId) {
        setCurrentlyPlayingId(msgId);
      }
      return await new Promise<boolean>((resolve) => {
        utterance.onend = () => {
          if (msgId) setCurrentlyPlayingId(null);
          resolve(true);
        };
        utterance.onerror = () => {
          if (msgId) setCurrentlyPlayingId(null);
          resolve(false);
        };
        window.speechSynthesis.speak(utterance);
      });
    } catch (e) {
      if (msgId) setCurrentlyPlayingId(null);
      return false;
    }
  };

  const generateSpeechWithRetry = async (text: string, retries: number = 1) => {
    try {
      if (ttsQuotaExceededRef.current) {
        throw new Error("TTS quota exceeded");
      }
      return await generateSpeech(text, settings.voiceName, apiKey);
    } catch (error) {
      if (isQuotaError(error)) {
        ttsQuotaExceededRef.current = true;
        throw error;
      }
      if (retries <= 0) throw error;
      await sleep(400);
      return generateSpeechWithRetry(text, retries - 1);
    }
  };

  const normalizeRepeatInput = (text: string) => text.toLowerCase().trim();
  const parseRepeatRequest = (text: string) => {
    const normalized = normalizeRepeatInput(text);
    if (!normalized) return null;
    const repeatPhrases = [
      'repeat',
      'repeat it',
      'repeat please',
      'say again',
      'again',
      'once more',
      'one more time',
      'مرة أخرى',
      'مرة ثانيه',
      'مرة ثانية',
      'اعِد',
      'أعِد',
      'كرر',
      'repite',
      'repita',
      'otra vez',
      'de nuevo',
      'encore',
      'répète',
      'répétez',
      'wiederholen',
      'nochmal',
      'noch einmal',
      'もう一度',
      '繰り返して',
      '再说一遍',
      '再說一遍',
      'повтори',
      'повторите'
    ];
    const directMatch = repeatPhrases.some(phrase => normalized === phrase);
    if (directMatch) return '';
    for (const phrase of repeatPhrases) {
      if (normalized.startsWith(phrase + ' ')) {
        return normalized.slice(phrase.length).trim();
      }
    }
    return null;
  };

  const buildChatExportHtml = (items: Message[], appSettings: AppSettings) => {
    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    const formatTime = (ts: number) => new Date(ts).toLocaleString();
    const renderVocab = (vocab: VocabularyItem[]) =>
      vocab.length
        ? `<div class="vocab">
            ${vocab
              .map(
                item => `
              <div class="vocab-item">
                <div class="vocab-term">${escapeHtml(item.term)}</div>
                <div class="vocab-meta">${escapeHtml(item.meaning)} · ${escapeHtml(item.partOfSpeech)}</div>
                ${
                  item.exampleTarget
                    ? `<div class="vocab-example"><span>Example:</span> ${escapeHtml(item.exampleTarget)}</div>`
                    : ''
                }
              </div>
            `
              )
              .join('')}
          </div>`
        : '';
    const renderFeedback = (feedback: AIResponseData['feedback'], userText?: string) => {
      if (!feedback || !feedback.hasError) return '';
      return `
        <div class="feedback">
          <div class="feedback-title">Correction ${feedback.type ? `· ${escapeHtml(feedback.type)}` : ''}</div>
          <div class="feedback-grid">
            <div>
              <div class="label">Your phrase</div>
              <div class="value">${escapeHtml(userText || '')}</div>
            </div>
            ${
              feedback.correction
                ? `<div>
                    <div class="label">Correction</div>
                    <div class="value">${escapeHtml(feedback.correction)}</div>
                  </div>`
                : ''
            }
            ${
              feedback.explanation
                ? `<div>
                    <div class="label">Tip</div>
                    <div class="value">${escapeHtml(feedback.explanation)}</div>
                  </div>`
                : ''
            }
          </div>
        </div>
      `;
    };

    const body = items
      .map(message => {
        if (message.sender === Sender.User && message.transcript) {
          return `
            <div class="bubble user">
              <div class="meta">${formatTime(message.timestamp)}</div>
              <div class="text">${escapeHtml(message.transcript.transcript)}</div>
              ${
                message.transcript.transliteration &&
                message.transcript.transliteration !== message.transcript.transcript
                  ? `<div class="subtext">${escapeHtml(message.transcript.transliteration)}</div>`
                  : ''
              }
            </div>
          `;
        }
        if (message.sender === Sender.Bot && message.content) {
          const data = message.content;
          return `
            <div class="bubble bot">
              <div class="meta">${formatTime(message.timestamp)}</div>
              <div class="text">${escapeHtml(data.targetText)}</div>
              ${data.transliteration ? `<div class="subtext">${escapeHtml(data.transliteration)}</div>` : ''}
              <div class="translation">${escapeHtml(data.englishTranslation)}</div>
              ${renderFeedback(data.feedback, data.userTranscript)}
              ${renderVocab(data.vocabulary)}
              ${
                data.culturalNotes.length
                  ? `<ul class="notes">${data.culturalNotes
                      .map(note => `<li>${escapeHtml(note)}</li>`)
                      .join('')}</ul>`
                  : ''
              }
            </div>
          `;
        }
        return '';
      })
      .join('');

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>LingoPal Chat Export</title>
    <style>
      :root { color-scheme: light; }
      body { font-family: "Segoe UI", system-ui, -apple-system, sans-serif; background: #f7f7fb; margin: 0; padding: 32px; color: #1f2937; }
      .page { max-width: 900px; margin: 0 auto; }
      header { background: linear-gradient(135deg,#6366f1,#14b8a6); color: white; padding: 24px; border-radius: 18px; box-shadow: 0 12px 30px rgba(15,23,42,0.15); }
      header h1 { margin: 0 0 8px; font-size: 28px; }
      header p { margin: 0; opacity: 0.9; font-size: 14px; }
      .meta-row { margin-top: 10px; font-size: 12px; opacity: 0.9; }
      .thread { margin-top: 24px; display: grid; gap: 18px; }
      .bubble { padding: 18px 20px; border-radius: 18px; position: relative; box-shadow: 0 10px 24px rgba(15,23,42,0.08); }
      .bubble.user { background: linear-gradient(135deg,#6366f1,#14b8a6); color: white; margin-left: auto; }
      .bubble.bot { background: white; border: 1px solid #e2e8f0; }
      .meta { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.7; margin-bottom: 8px; }
      .text { font-size: 20px; font-weight: 700; }
      .subtext { margin-top: 6px; font-style: italic; font-size: 14px; opacity: 0.85; }
      .translation { margin-top: 8px; font-size: 15px; color: #0f172a; opacity: 0.8; }
      .feedback { margin-top: 14px; padding: 14px; background: #fef3f2; border-radius: 12px; border: 1px solid #fecdd3; }
      .feedback-title { font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #be123c; margin-bottom: 8px; }
      .feedback-grid { display: grid; gap: 10px; font-size: 13px; }
      .feedback .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.15em; color: #9f1239; margin-bottom: 4px; }
      .feedback .value { color: #881337; font-weight: 600; }
      .vocab { display: grid; gap: 10px; margin-top: 14px; }
      .vocab-item { background: #f8fafc; padding: 12px; border-radius: 12px; border: 1px solid #e2e8f0; }
      .vocab-term { font-weight: 700; font-size: 15px; }
      .vocab-meta { font-size: 12px; color: #64748b; margin-top: 4px; }
      .vocab-example { font-size: 12px; margin-top: 6px; color: #0f172a; }
      .vocab-example span { color: #14b8a6; font-weight: 600; }
      .notes { margin: 12px 0 0; padding-left: 18px; color: #0f172a; font-size: 13px; }
      .notes li { margin-bottom: 6px; }
      footer { margin-top: 24px; font-size: 11px; color: #64748b; text-align: center; }
    </style>
  </head>
  <body>
    <div class="page">
      <header>
        <h1>LingoPal Chat Export</h1>
        <p>Target language: ${escapeHtml(appSettings.targetLanguage)} · Accent: ${escapeHtml(appSettings.accent)}</p>
        <div class="meta-row">Generated on ${escapeHtml(new Date().toLocaleString())}</div>
      </header>
      <section class="thread">
        ${body}
      </section>
      <footer>Keep practicing. You are making steady progress.</footer>
    </div>
  </body>
</html>`;
  };

  const handleDownloadChat = () => {
    if (messages.length === 0) return;
    const html = buildChatExportHtml(messages, settings);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `lingopal-chat-${new Date().toISOString().slice(0, 10)}.html`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const getVocabCacheKey = (term: string) => `${settings.voiceName}::${term}`;
  const prefetchVocabAudio = async (vocab: VocabularyItem[]) => {
    if (!apiKey || vocab.length === 0) return;
    if (ttsQuotaExceededRef.current) return;
    if (isRecordingRef.current || isLoadingRef.current) return;
    const ctx = ensureAudioContext();
    if (!ctx) return;
    const limited = vocab.slice(0, 1);
    for (const item of limited) {
      const key = getVocabCacheKey(item.term);
      if (vocabAudioCacheRef.current.has(key)) continue;
      try {
        const audioBase64 = await generateSpeech(item.term, settings.voiceName, apiKey);
        const buffer = await decodeAudioData(audioBase64, ctx);
        vocabAudioCacheRef.current.set(key, buffer);
      } catch (e) {
        if (isQuotaError(e)) {
          ttsQuotaExceededRef.current = true;
          return;
        }
        // ignore prefetch errors
      }
    }
  };

  const tryPlayPending = (retryCount: number = 0) => {
    if (retryCount > 20) {
      console.warn("Gave up trying to play pending audio");
      setAudioUnlockRequired(true);
      return;
    }
    const pendingId = pendingAutoPlayQueueRef.current[0];
    if (!pendingId) return;
    const msg = messagesRef.current.find(m => m.id === pendingId);
    if (msg?.audioBuffer) {
      playMessageAudio(pendingId, msg.audioBuffer).then((played) => {
        if (played) {
          pendingAutoPlayQueueRef.current.shift();
        } else {
          setAudioUnlockRequired(true);
          setTimeout(() => tryPlayPending(retryCount + 1), 250);
        }
      });
      return;
    }
    setTimeout(() => tryPlayPending(retryCount + 1), 250);
  };

  // --- Recording Handlers ---
  const startRecording = async () => {
    if (apiKeyMissing) {
      setIsSettingsOpen(true);
      return;
    }

    try {
      ensureAudioContext();
      await unlockAudioContext();
      recordingStartRef.current = Date.now();
      noiseFloorRef.current = null;
      if (settings.micCues) {
        playBeep(880, 120);
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = handleRecordingComplete;
      mediaRecorder.start();
      setIsRecording(true);
      stopAudioPlayback();

      // Initialize VAD
      setupVAD(stream);

    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access microphone. Please ensure permissions are granted.");
    }
  };

  const setupVAD = (stream: MediaStream) => {
    if (!audioContextRef.current) return;
    
    // Ensure context is running (it might be suspended by browser policy)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    const source = audioContextRef.current.createMediaStreamSource(stream);
    const analyser = audioContextRef.current.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.3; // Faster response
    source.connect(analyser);
    
    vadSourceRef.current = source;
    analyserRef.current = analyser;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Polling for volume (visualizer only; recording stops manually)
    let samples = 0;
    let baselineSum = 0;
    vadIntervalRef.current = window.setInterval(() => {
      if (!isRecording && mediaRecorderRef.current?.state === 'inactive') {
        if (vadIntervalRef.current) clearInterval(vadIntervalRef.current);
        return;
      }

      analyser.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      let sum = 0;
      for(let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      if (settings.noiseGuard && samples < 12) {
        baselineSum += average;
        samples += 1;
        if (samples === 12) {
          noiseFloorRef.current = baselineSum / samples;
        }
      }
      const floor = settings.noiseGuard && noiseFloorRef.current ? noiseFloorRef.current : 0;
      const adjusted = Math.max(0, average - floor);
      // Update visualizer (normalized roughly 0-1)
      setVolumeLevel(Math.min(adjusted / 100, 1));

    }, 75); // Refresh rate for VAD and visualizer
  };

  const stopRecording = async () => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    
    // Cleanup VAD Audio Nodes
    if (vadSourceRef.current) {
      try { vadSourceRef.current.disconnect(); } catch (e) {}
      vadSourceRef.current = null;
    }
    if (analyserRef.current) {
      try { analyserRef.current.disconnect(); } catch (e) {}
      analyserRef.current = null;
    }
    setVolumeLevel(0);
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    if (settings.micCues) {
      playBeep(520, 100);
    }
    await unlockAudioContext();
    if (pendingAutoPlayQueueRef.current.length > 0) {
      setTimeout(() => tryPlayPending(1), 250);
    }
  };

  const handleRecordingComplete = async () => {
    // Small delay to ensure state updates
    setIsRecording(false);
    setVolumeLevel(0);
    
    if (audioChunksRef.current.length === 0) return;

    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    setIsLoading(true);

    try {
      // 1. Analyze Audio (The longest wait)
      let responseData = await analyzeAudioAndRespond(
        audioBlob,
        messages,
        settings.targetLanguage,
        settings.goal,
        settings.nativeMode,
        settings.accent,
        settings.userName,
        apiKey
      );

      if (responseData.systemCommand) {
        handleSystemCommand(responseData.systemCommand);
      }

      const repeatRequest = parseRepeatRequest(responseData.userTranscript);
      if (repeatRequest !== null) {
        const requestedText = repeatRequest.trim();
        if (requestedText) {
          responseData = {
            ...responseData,
            targetText: requestedText,
            englishTranslation: requestedText,
            transliteration: requestedText,
            vocabulary: [],
            culturalNotes: [],
            feedback: undefined,
            systemCommand: undefined
          };
        } else {
          const lastBot = [...messagesRef.current].reverse().find(m => m.sender === Sender.Bot && m.content);
          if (lastBot?.content) {
            responseData = {
              ...lastBot.content,
              userTranscript: responseData.userTranscript,
              userTransliteration: responseData.userTransliteration,
              sourceLanguage: responseData.sourceLanguage,
              vocabulary: [],
              culturalNotes: [],
              feedback: undefined,
              systemCommand: undefined
            };
          }
        }
      }

      const userMsg: Message = {
        id: crypto.randomUUID(),
        sender: Sender.User,
        timestamp: Date.now(),
        transcript: {
          transcript: responseData.userTranscript,
          transliteration: responseData.userTransliteration
        }
      };

      const botMsgId = crypto.randomUUID();
      if (!pendingAutoPlayQueueRef.current.includes(botMsgId)) {
        pendingAutoPlayQueueRef.current.push(botMsgId);
      }
      let paceOverride: number | undefined;
      if (settings.paceMatch && recordingStartRef.current) {
        const durationSec = Math.max(1, (Date.now() - recordingStartRef.current) / 1000);
        const wordCount = responseData.userTranscript.trim().split(/\s+/).filter(Boolean).length;
        const wpm = (wordCount / durationSec) * 60;
        const pace = Math.min(1.2, Math.max(0.8, wpm / 130));
        paceOverride = Number.isFinite(pace) ? pace : undefined;
      }
      const botMsg: Message = {
        id: botMsgId,
        sender: Sender.Bot,
        timestamp: Date.now(),
        content: responseData,
        playbackRateOverride: paceOverride
      };

      // 2. Render Text Immediately
      setMessages(prev => [...prev, userMsg, botMsg]);
      setIsLoading(false); // Stop "Thinking" spinner so user can read
      void prefetchVocabAudio(responseData.vocabulary);

      // 3. Generate Audio in Background
      const ttsText = responseData.targetText;
      try {
        const audioBase64 = await generateSpeechWithRetry(ttsText);
        const ctx = ensureAudioContext();
        if (ctx) {
           const buffer = await decodeAudioData(audioBase64, ctx);
           
           // 4. Attach Audio & Play
           setMessages(prev => prev.map(m => {
             if (m.id === botMsgId) {
               return { ...m, audioUrl: "available", audioBuffer: buffer };
             }
             return m;
           }));
          const unlocked = await unlockAudioContext();
          if (!unlocked) {
            setAudioUnlockRequired(true);
          }
          const played = await playMessageAudio(botMsgId, buffer, paceOverride);
          if (!played) {
            setAudioUnlockRequired(true);
            setTimeout(() => tryPlayPending(1), 250);
          } else {
            setAudioUnlockRequired(false);
            if (pendingAutoPlayQueueRef.current[0] === botMsgId) {
              pendingAutoPlayQueueRef.current.shift();
            }
          }
        }
      } catch (ttsError) {
        console.error("TTS failed", ttsError);
        if (isQuotaError(ttsError)) {
          pendingAutoPlayQueueRef.current = pendingAutoPlayQueueRef.current.filter(id => id !== botMsgId);
          await speakWithBrowser(ttsText, botMsgId, paceOverride);
        }
      }

    } catch (error) {
      console.error("Analysis failed", error);
      setIsLoading(false);
    }
  };

  const handleSystemCommand = (cmd: AIResponseData['systemCommand']) => {
    if (!cmd) return;
    setSettings(prev => {
      const next = { ...prev };
      if (cmd.action === 'SET_SPEED' && cmd.speedValue && !settingsRef.current.paceMatch) {
        next.speechSpeed = cmd.speedValue;
      }
      return next;
    });
    if (cmd.action === 'OPEN_SETTINGS') setIsSettingsOpen(true);
    if (cmd.action === 'CLOSE_SETTINGS') setIsSettingsOpen(false);
  };

  const playMessageAudio = async (msgId: string, buffer?: AudioBuffer, rateOverride?: number) => {
    stopAudioPlayback();

    const ctx = ensureAudioContext();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
        await sleep(50);
      } catch (e) {
        console.warn("Failed to resume AudioContext:", e);
      }
    }
    if (ctx.state !== 'running') {
      console.warn(`AudioContext not running (state: ${ctx.state})`);
      if (!pendingAutoPlayQueueRef.current.includes(msgId)) {
        pendingAutoPlayQueueRef.current.push(msgId);
      }
      setAudioUnlockRequired(true);
      return false;
    }

    let audioBuffer = buffer;
    if (!audioBuffer) {
      const msg = messagesRef.current.find(m => m.id === msgId);
      if (msg?.audioBuffer) {
        audioBuffer = msg.audioBuffer;
      }
    }

    if (audioBuffer) {
      const msg = messagesRef.current.find(m => m.id === msgId);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = rateOverride ?? msg?.playbackRateOverride ?? settings.speechSpeed;
      source.connect(ctx.destination);
      source.onended = () => {
        setCurrentlyPlayingId(null);
        if (shadowStartTimeoutRef.current) {
          clearTimeout(shadowStartTimeoutRef.current);
        }
        if (settingsRef.current.shadowMode && !isRecordingRef.current && !isLoadingRef.current) {
          shadowStartTimeoutRef.current = window.setTimeout(() => {
            if (settingsRef.current.shadowMode && !isRecordingRef.current && !isLoadingRef.current) {
              startRecording();
            }
          }, 800);
        }
      };
      
      sourceNodeRef.current = source;
      source.start();
      setCurrentlyPlayingId(msgId);
      setAudioUnlockRequired(false);
      return true;
    }
    return false;
  };

  const stopAudioPlayback = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch(e) { }
      sourceNodeRef.current = null;
    }
    setCurrentlyPlayingId(null);
  };

  const handleRephrase = async (messageId: string, style: 'natural' | 'casual' | 'formal') => {
    const original = messages.find(m => m.id === messageId && m.sender === Sender.Bot)?.content;
    if (!original || isLoading) return;
    setIsLoading(true);
    try {
      const { rephraseText } = await import('./services/gemini');
      const rephrased = await rephraseText(
        original.targetText,
        style,
        settings.targetLanguage,
        settings.goal,
        settings.nativeMode,
        settings.accent,
        apiKey
      );
      const botMsg: Message = {
        id: crypto.randomUUID(),
        sender: Sender.Bot,
        timestamp: Date.now(),
        content: { ...rephrased, rephraseStyle: style }
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (e) {
      console.error("Rephrase failed", e);
    } finally {
      setIsLoading(false);
    }
  };

  const playBuffer = async (buffer: AudioBuffer, rateOverride?: number) => {
    stopAudioPlayback();
    const ctx = ensureAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    if (ctx.state !== 'running') {
      return;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rateOverride ?? settings.speechSpeed;
    source.connect(ctx.destination);
    source.onended = () => setCurrentlyPlayingId(null);
    sourceNodeRef.current = source;
    source.start();
  };

  const handleSpeakVocab = async (term: string) => {
    if (!term || !apiKey) return;
    try {
      const cacheKey = getVocabCacheKey(term);
      const cached = vocabAudioCacheRef.current.get(cacheKey);
      if (cached) {
        await playBuffer(cached, 0.95);
        return;
      }
      const audioBase64 = await generateSpeech(term, settings.voiceName, apiKey);
      const ctx = ensureAudioContext();
      if (!ctx) return;
      const buffer = await decodeAudioData(audioBase64, ctx);
      vocabAudioCacheRef.current.set(cacheKey, buffer);
      await playBuffer(buffer, 0.95);
    } catch (e) {
      console.error("Vocab TTS failed", e);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-transparent relative selection:bg-primary-light font-sans">
      {/* Living Mesh Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
         <div className="noise-bg absolute inset-0 z-10 pointer-events-none mix-blend-multiply opacity-35"></div>
         <div className="absolute top-[-10%] left-[-10%] w-[800px] h-[800px] bg-primary-light/25 rounded-full blur-[110px] opacity-50 animate-float"></div>
         <div className="absolute bottom-[-20%] right-[-10%] w-[700px] h-[700px] bg-secondary-soft/45 rounded-full blur-[110px] opacity-45 animate-float" style={{ animationDelay: '3s' }}></div>
         <div className="absolute top-[40%] left-[40%] w-[500px] h-[500px] bg-white rounded-full blur-[90px] opacity-30 animate-breathe"></div>
      </div>
      
      {/* Floating Glass Header */}
      <header className="flex-none absolute top-[calc(env(safe-area-inset-top)+0.4rem)] sm:top-3 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="pointer-events-auto flex items-center justify-between gap-4 px-3 py-1.5 rounded-full bg-surface-glass backdrop-blur-xl shadow-soft border border-white/60 w-[90%] max-w-lg transition-all hover:bg-white/70 hover:shadow-md">
          
          {/* Logo Badge */}
          <div className="flex items-center gap-2 pl-1">
             <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary via-info to-secondary flex items-center justify-center text-white shadow-glow ring-2 ring-white">
               <Sparkles size={14} className="animate-pulse-slow" />
             </div>
            <span className="text-sm font-extrabold font-sans tracking-tight hidden sm:block bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent animate-pulse-slow">
               LingoPal
            </span>
          </div>

          <div className="h-4 w-px bg-gradient-to-b from-black/10 via-black/25 to-black/10 mx-1"></div>

          {/* Settings Trigger */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleDownloadChat}
              disabled={messages.length === 0}
              className="p-2 text-text-soft hover:text-primary rounded-full transition-all duration-300 hover:bg-white/50 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Download chat"
            >
              <Download size={18} />
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-text-soft hover:text-primary rounded-full transition-all duration-300 hover:bg-white/50 group"
              aria-label="Settings"
            >
              <Settings size={18} className="group-hover:rotate-90 transition-transform duration-500" />
            </button>
          </div>
        </div>
      </header>

      {apiKeyMissing && (
        <div className="absolute top-20 left-0 right-0 z-20 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-3 bg-surface-glass border border-red-100 shadow-soft rounded-full px-4 py-2 text-sm text-text-strong">
            <AlertTriangle size={16} className="text-red-500" />
            <span>Gemini API key required to start.</span>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="text-primary font-semibold hover:text-primary-hover"
            >
              Open settings
            </button>
          </div>
        </div>
      )}
      {audioUnlockRequired && (
        <div className="absolute top-20 left-0 right-0 z-20 flex justify-center px-4 mt-14">
          <button
            onClick={async () => {
              const unlocked = await unlockAudioContext();
              tryPlayPending();
              setAudioUnlockRequired(!unlocked);
            }}
            className="pointer-events-auto flex items-center gap-2 bg-surface-glass border border-stone-200 shadow-soft rounded-full px-4 py-2 text-sm text-text-strong hover:border-primary/30"
          >
            Enable audio
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative z-10 h-full pt-16">
        <ChatInterface 
          messages={messages} 
          isLoading={isLoading} 
          playbackSpeed={settings.speechSpeed}
          currentlyPlayingId={currentlyPlayingId}
          onPlay={(id) => playMessageAudio(id)}
          onPlaySlow={(id) => playMessageAudio(id, undefined, 0.8)}
          onStop={stopAudioPlayback}
          targetLanguage={settings.targetLanguage}
          onRephrase={handleRephrase}
          onSpeakVocab={handleSpeakVocab}
        />
      </main>

      {/* Floating Action / Record Area - Gradient Anchoring */}
      <div className="flex-none z-20 pointer-events-none absolute bottom-0 left-0 right-0 pb-[calc(env(safe-area-inset-bottom)+2rem)] sm:pb-8 pt-20 sm:pt-24 bg-gradient-to-t from-surface-background via-surface-background/80 to-transparent">
        <div className="max-w-md mx-auto flex justify-center pointer-events-auto">
           <RecordButton 
             isRecording={isRecording} 
             onStart={startRecording} 
             onStop={stopRecording}
             disabled={isLoading}
             volumeLevel={volumeLevel}
           />
        </div>
      </div>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onChangeSettings={setSettings}
      />
    </div>
  );
}

export default App;