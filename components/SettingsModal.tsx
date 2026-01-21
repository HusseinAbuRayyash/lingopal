import { AppSettings, AVAILABLE_VOICES, AVAILABLE_LANGUAGES, AVAILABLE_GOALS, AVAILABLE_ACCENTS } from '../types';
import { X, Volume2, Zap, Check, Globe, KeyRound, User } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onChangeSettings: (newSettings: AppSettings) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onChangeSettings }) => {
  if (!isOpen) return null;

  const handleChange = (key: keyof AppSettings, value: any) => {
    onChangeSettings({ ...settings, [key]: value });
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/25 backdrop-blur-md animate-in fade-in duration-300 cursor-pointer"
      onClick={onClose}
    >
      <div 
        className="bg-surface-glass backdrop-blur-2xl rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 border border-white/40 ring-1 ring-white/50 cursor-auto flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-none flex items-center justify-between p-6 sm:p-8 pb-4 sm:pb-6 border-b border-stone-100/50 bg-surface-glass">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-text-strong tracking-tight">Preferences</h2>
            <p className="text-xs sm:text-sm text-text-soft font-medium">Personalize your tutor</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2.5 text-text-muted hover:text-text-strong hover:bg-white rounded-full transition-all border border-transparent hover:border-stone-200 hover:shadow-sm"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Scrollable Content */}
        <div className="flex-1 p-6 sm:p-8 space-y-8 sm:space-y-10 bg-surface-background/40 overflow-y-auto">
          
          {/* Language Selection */}
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-[11px] font-bold text-text-muted uppercase tracking-widest">
              <Globe size={14} className="text-secondary" />
              Target Language
            </label>
            <div className="flex overflow-x-auto gap-3 pb-2 no-scrollbar snap-x">
              {AVAILABLE_LANGUAGES.map(lang => {
                const isSelected = settings.targetLanguage === lang;
                return (
                  <button
                    key={lang}
                    onClick={() => handleChange('targetLanguage', lang)}
                    className={`flex-none snap-center px-6 py-4 text-sm font-bold rounded-2xl border transition-all duration-200 shadow-sm min-w-[100px] flex items-center justify-center ${
                      isSelected 
                        ? 'border-secondary bg-secondary/10 text-secondary ring-1 ring-secondary/20' 
                        : 'border-white bg-white/80 text-text-soft hover:border-stone-200 hover:bg-white'
                    }`}
                  >
                    {lang}
                  </button>
                );
              })}
            </div>
          </div>

          {/* API Key */}
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-[11px] font-bold text-text-muted uppercase tracking-widest">
              <KeyRound size={14} className="text-primary" />
              Gemini API Key
            </label>
            <div className="bg-white/75 p-4 rounded-[1.25rem] border border-stone-100/80 shadow-sm">
              <input
                type="password"
                placeholder="Paste your API key"
                value={settings.apiKey}
                onChange={(e) => handleChange('apiKey', e.target.value)}
                className="w-full bg-transparent text-sm text-text-strong placeholder:text-text-muted focus:outline-none"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-[11px] text-text-muted mt-2">
                Stored locally in your browser. Get a key from{" "}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary font-semibold hover:text-primary-hover"
                >
                  Google AI Studio
                </a>
                .
              </p>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-[11px] font-bold text-text-muted uppercase tracking-widest">
              <User size={14} className="text-secondary" />
              Your Name
            </label>
            <div className="bg-white/75 p-4 rounded-[1.25rem] border border-stone-100/80 shadow-sm">
              <input
                type="text"
                placeholder="How should I address you?"
                value={settings.userName}
                onChange={(e) => handleChange('userName', e.target.value)}
                className="w-full bg-transparent text-sm text-text-strong placeholder:text-text-muted focus:outline-none"
                autoComplete="off"
                spellCheck={false}
                maxLength={40}
              />
              <p className="text-[11px] text-text-muted mt-2">
                Optional. Used to personalize responses.
              </p>
            </div>
          </div>

          {/* Voice Selection */}
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-[11px] font-bold text-text-muted uppercase tracking-widest">
              <Volume2 size={14} className="text-primary" />
              AI Voice Persona
            </label>
            <div className="grid grid-cols-2 gap-3">
              {AVAILABLE_VOICES.map(voice => {
                const isSelected = settings.voiceName === voice;
                return (
                  <button
                    key={voice}
                    onClick={() => handleChange('voiceName', voice)}
                    className={`relative px-4 py-4 text-sm font-bold rounded-2xl border transition-all duration-200 flex items-center justify-center shadow-sm ${
                      isSelected 
                        ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/20' 
                        : 'border-white bg-white/75 text-text-soft hover:border-stone-200 hover:bg-white'
                    }`}
                  >
                    {voice}
                    {isSelected && (
                      <div className="absolute top-3 right-3 w-1.5 h-1.5 bg-primary rounded-full shadow-glow"></div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Learning Goal */}
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-[11px] font-bold text-text-muted uppercase tracking-widest">
              <Check size={14} className="text-secondary" />
              Learning Goal
            </label>
            <div className="flex flex-wrap gap-3">
              {AVAILABLE_GOALS.map(goal => {
                const isSelected = settings.goal === goal;
                return (
                  <button
                    key={goal}
                    onClick={() => handleChange('goal', goal)}
                    className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all duration-200 shadow-sm ${
                      isSelected
                        ? 'border-secondary bg-secondary/10 text-secondary ring-1 ring-secondary/20'
                        : 'border-white bg-white/80 text-text-soft hover:border-stone-200 hover:bg-white'
                    }`}
                  >
                    {goal}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Speed Control */}
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-[11px] font-bold text-text-muted uppercase tracking-widest">
              <Zap size={14} className="text-secondary" />
              Speaking Pace
            </label>
            <div className="bg-white/75 p-6 rounded-[1.5rem] border border-stone-100/80 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <span className="text-[10px] text-text-muted font-bold tracking-wide uppercase">Relaxed</span>
                <span className="text-xl font-bold text-secondary font-mono bg-secondary/10 px-4 py-1 rounded-xl">{settings.speechSpeed}x</span>
                <span className="text-[10px] text-text-muted font-bold tracking-wide uppercase">Rapid</span>
              </div>
              <input 
                type="range" 
                min="0.5" 
                max="1.5" 
                step="0.1"
                value={settings.speechSpeed}
                onChange={(e) => handleChange('speechSpeed', parseFloat(e.target.value))}
                className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-secondary hover:accent-secondary-hover focus:outline-none focus:ring-4 focus:ring-secondary/10 transition-all"
                style={{
                  backgroundImage: `linear-gradient(to right, var(--tw-color-secondary) 0%, var(--tw-color-secondary) ${(settings.speechSpeed - 0.5) * 100}%, #e5e7eb ${(settings.speechSpeed - 0.5) * 100}%, #e5e7eb 100%)`
                }}
              />
            </div>
          </div>

          {/* Native Mode Toggle */}
          <div className="flex items-center justify-between p-5 bg-white/75 rounded-[1.5rem] border border-stone-100/80 shadow-sm hover:shadow-card transition-all">
            <div className="flex items-center gap-4">
              <div className={`p-3.5 rounded-2xl transition-colors duration-300 ${settings.nativeMode ? 'bg-emerald-50 text-emerald-600' : 'bg-stone-100 text-stone-400'}`}>
                 <Zap size={20} />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-text-strong text-sm">Speak Like a Native</span>
                <span className="text-[11px] text-text-muted font-medium mt-0.5">Natural phrasing & rhythm</span>
              </div>
            </div>
            
            <button
              onClick={() => handleChange('nativeMode', !settings.nativeMode)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-emerald-50 ${
                settings.nativeMode ? 'bg-emerald-500' : 'bg-stone-200'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
                  settings.nativeMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Accent Selection */}
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-[11px] font-bold text-text-muted uppercase tracking-widest">
              <Globe size={14} className="text-secondary" />
              Accent Focus
            </label>
            <div className="flex flex-wrap gap-3">
              {AVAILABLE_ACCENTS.map(accent => {
                const isSelected = settings.accent === accent;
                return (
                  <button
                    key={accent}
                    onClick={() => handleChange('accent', accent)}
                    className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all duration-200 shadow-sm ${
                      isSelected
                        ? 'border-secondary bg-secondary/10 text-secondary ring-1 ring-secondary/20'
                        : 'border-white bg-white/80 text-text-soft hover:border-stone-200 hover:bg-white'
                    }`}
                  >
                    {accent}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Speaking Helpers */}
          <div className="grid grid-cols-1 gap-3">
            {[
              {
                label: "Pace Match",
                desc: "Match your speaking rate",
                key: "paceMatch"
              },
              {
                label: "Shadow Mode",
                desc: "Auto‑start mic after replies",
                key: "shadowMode"
              },
              {
                label: "Mic Cues",
                desc: "Start/stop beep",
                key: "micCues"
              },
              {
                label: "Noise Guard",
                desc: "Stabilize mic levels",
                key: "noiseGuard"
              }
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between p-4 bg-white/75 rounded-[1.25rem] border border-stone-100/80 shadow-sm">
                <div className="flex flex-col">
                  <span className="font-bold text-text-strong text-sm">{item.label}</span>
                  <span className="text-[11px] text-text-muted font-medium mt-0.5">{item.desc}</span>
                </div>
                <button
                  onClick={() => handleChange(item.key as keyof AppSettings, !settings[item.key as keyof AppSettings])}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-secondary/10 ${
                    settings[item.key as keyof AppSettings] ? 'bg-secondary' : 'bg-stone-200'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
                      settings[item.key as keyof AppSettings] ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex-none p-6 bg-stone-50/40 border-t border-stone-100/50 flex items-center justify-between backdrop-blur-sm">
            <button 
              onClick={() => {
                onChangeSettings({
                  targetLanguage: 'Arabic',
                  voiceName: 'Zephyr',
                  speechSpeed: 1.0,
                  apiKey: settings.apiKey,
                  userName: '',
                  goal: 'Casual',
                  nativeMode: false,
                  paceMatch: false,
                  shadowMode: false,
                  micCues: true,
                  noiseGuard: true,
                  accent: 'Neutral'
                });
              }}
              className="text-[10px] font-bold text-text-muted hover:text-primary transition-colors uppercase tracking-[0.2em] px-2 py-2"
            >
              Reset Defaults
            </button>

            <button
              onClick={onClose}
              className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-primary/30 transition-all hover:scale-105 active:scale-95"
            >
              <Check size={16} strokeWidth={3} />
              <span>Done</span>
            </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
