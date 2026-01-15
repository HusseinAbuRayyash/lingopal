import React, { useState, useRef, useEffect } from 'react';
import { Message, AppSettings, Sender, AIResponseData } from './types';
import { analyzeAudioAndRespond, generateSpeech } from './services/gemini';
import { decodeAudioData } from './utils/audio';
import ChatInterface from './components/ChatInterface';
import RecordButton from './components/RecordButton';
import SettingsModal from './components/SettingsModal';
import { Settings, Sparkles, AlertTriangle } from 'lucide-react';

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
  const coachPhrases = [
    "You're improving fast — keep going.",
    "Good energy. Let's polish it.",
    "Almost there — just a small tweak.",
    "Nice effort. You're on the right track.",
    "That was brave — let's tighten it up.",
    "Solid attempt. You're close.",
    "We're getting it. One more try.",
    "You're doing great. Keep the rhythm."
  ];
  const repeatPhrases = [
    "Say it with me:",
    "Try this:",
    "Here it is:",
    "Let's say it:",
    "Give this a go:"
  ];
  const humorPhrases = [
    "Your brain is buffering — totally normal.",
    "Close enough to fool a tourist — almost.",
    "That one had potential. We'll give it a remix.",
    "If language were coffee, you're at a solid espresso."
  ];
  const getRandom = (items: string[]) => items[Math.floor(Math.random() * items.length)];
  const maybeHumor = () => (Math.random() < 0.25 ? getRandom(humorPhrases) : null);

  // --- Refs ---
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const pendingAutoPlayQueueRef = useRef<string[]>([]);
  const messagesRef = useRef<Message[]>([]);
  
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
      await unlockAudioContext();
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

  const unlockAudioContext = async () => {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (e) {
        // Ignore resume failures; playback will fallback to manual tap.
      }
    }
    // Play a near-silent tick to unlock autoplay on some browsers.
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 30;
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      osc.start(now);
      osc.stop(now + 0.02);
    } catch (e) {
      // No-op
    }
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const generateSpeechWithRetry = async (text: string, retries: number = 1) => {
    try {
      return await generateSpeech(text, settings.voiceName, apiKey);
    } catch (error) {
      if (retries <= 0) throw error;
      await sleep(400);
      return generateSpeechWithRetry(text, retries - 1);
    }
  };

  const tryPlayPending = () => {
    const pendingId = pendingAutoPlayQueueRef.current[0];
    if (!pendingId) return;
    const msg = messagesRef.current.find(m => m.id === pendingId);
    if (msg?.audioBuffer) {
      playMessageAudio(pendingId, msg.audioBuffer).then((played) => {
        if (played) {
          pendingAutoPlayQueueRef.current.shift();
        } else {
          setAudioUnlockRequired(true);
          setTimeout(tryPlayPending, 250);
        }
      });
      return;
    }
    setTimeout(tryPlayPending, 250);
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
      setTimeout(tryPlayPending, 250);
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
      const responseData = await analyzeAudioAndRespond(
        audioBlob,
        messages,
        settings.targetLanguage,
        settings.goal,
        settings.nativeMode,
        settings.accent,
        apiKey
      );

      if (responseData.systemCommand) {
        handleSystemCommand(responseData.systemCommand);
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

      try {
        // 3. Generate Audio in Background
        const ttsText =
          responseData.feedback?.hasError
            ? [
                responseData.feedback.correction
                  ? `I heard you say: ${responseData.userTranscript}. Try: ${responseData.feedback.correction}.`
                  : `I heard you say: ${responseData.userTranscript}.`,
                responseData.feedback.explanation
                  ? `${responseData.feedback.explanation}.`
                  : null,
                `${getRandom(repeatPhrases)} ${responseData.targetText}.`,
                maybeHumor(),
                getRandom(coachPhrases)
              ]
                .filter(Boolean)
                .join(" ")
            : responseData.targetText;
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
          await unlockAudioContext();
          const played = await playMessageAudio(botMsgId, buffer, paceOverride);
          if (!played) {
            setAudioUnlockRequired(true);
            setTimeout(tryPlayPending, 250);
          } else {
            setAudioUnlockRequired(false);
            if (pendingAutoPlayQueueRef.current[0] === botMsgId) {
              pendingAutoPlayQueueRef.current.shift();
            }
          }
        }
      } catch (ttsError) {
        console.error("TTS failed", ttsError);
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
      if (cmd.action === 'SET_VOICE' && cmd.voiceValue) next.voiceName = cmd.voiceValue;
      if (cmd.action === 'SET_SPEED' && cmd.speedValue) next.speechSpeed = cmd.speedValue;
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
      await ctx.resume();
    }
    if (ctx.state !== 'running') {
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
        if (settings.shadowMode && !isRecording && !isLoading) {
          setTimeout(() => {
            if (!isRecording && !isLoading) {
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
      const audioBase64 = await generateSpeech(term, settings.voiceName, apiKey);
      const ctx = ensureAudioContext();
      if (!ctx) return;
      const buffer = await decodeAudioData(audioBase64, ctx);
      await playBuffer(buffer, 0.9);
    } catch (e) {
      console.error("Vocab TTS failed", e);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-surface-background relative selection:bg-primary-light font-sans">
      {/* Living Mesh Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
         <div className="noise-bg absolute inset-0 z-10 pointer-events-none mix-blend-multiply opacity-50"></div>
         <div className="absolute top-[-10%] left-[-10%] w-[800px] h-[800px] bg-primary-light/30 rounded-full blur-[100px] opacity-60 animate-float"></div>
         <div className="absolute bottom-[-20%] right-[-10%] w-[700px] h-[700px] bg-secondary-soft/50 rounded-full blur-[100px] opacity-50 animate-float" style={{ animationDelay: '3s' }}></div>
         <div className="absolute top-[40%] left-[40%] w-[500px] h-[500px] bg-white rounded-full blur-[80px] opacity-40 animate-breathe"></div>
      </div>
      
      {/* Floating Glass Header */}
      <header className="flex-none absolute top-[calc(env(safe-area-inset-top)+0.5rem)] sm:top-4 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="pointer-events-auto flex items-center justify-between gap-4 px-3 py-2 rounded-full bg-white/50 backdrop-blur-xl shadow-soft border border-white/60 w-[90%] max-w-lg transition-all hover:bg-white/70 hover:shadow-md">
          
          {/* Logo Badge */}
          <div className="flex items-center gap-2 pl-1">
             <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-glow to-primary flex items-center justify-center text-white shadow-glow ring-2 ring-white">
               <Sparkles size={14} className="animate-pulse-slow" />
             </div>
            <span className="text-sm font-extrabold font-sans tracking-tight hidden sm:block bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent animate-pulse-slow">
               LingoPal
            </span>
          </div>

          <div className="h-4 w-px bg-stone-300/50 mx-1"></div>

          {/* Settings Trigger */}
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-text-soft hover:text-primary rounded-full transition-all duration-300 hover:bg-white/50 group"
            aria-label="Settings"
          >
            <Settings size={18} className="group-hover:rotate-90 transition-transform duration-500" />
          </button>
        </div>
      </header>

      {apiKeyMissing && (
        <div className="absolute top-20 left-0 right-0 z-20 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-3 bg-white/90 border border-red-100 shadow-soft rounded-full px-4 py-2 text-sm text-text-strong">
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
              await unlockAudioContext();
              tryPlayPending();
              setAudioUnlockRequired(false);
            }}
            className="pointer-events-auto flex items-center gap-2 bg-white/90 border border-stone-200 shadow-soft rounded-full px-4 py-2 text-sm text-text-strong hover:border-primary/30"
          >
            Enable audio
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative z-10 h-full pt-20">
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