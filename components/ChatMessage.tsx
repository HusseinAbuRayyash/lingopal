import React, { useState } from 'react';
import { Message, VocabularyItem } from '../types';
import { Play, Pause, Bot, BookOpen, X, Copy, Sparkles, Volume2 } from 'lucide-react';
import { clsx } from 'clsx';

interface ChatMessageProps {
  message: Message;
  playbackSpeed: number;
  currentlyPlayingId: string | null;
  onPlay: (id: string) => void;
  onPlaySlow: (id: string) => void;
  onStop: () => void;
  targetLanguage: string;
  onRephrase: (messageId: string, style: 'natural' | 'casual' | 'formal') => void;
  onSpeakVocab: (term: string) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ 
  message, 
  currentlyPlayingId, 
  onPlay, 
  onPlaySlow,
  onStop,
  targetLanguage,
  onRephrase,
  onSpeakVocab
}) => {
  const isBot = message.sender === 'bot';
  const isPlaying = currentlyPlayingId === message.id;
  const [selectedVocab, setSelectedVocab] = useState<{ vocab: VocabularyItem; styleIndex: number } | null>(null);
  
  const isRTL = targetLanguage === 'Arabic';
  const vocabStyles = [
    {
      container: "bg-emerald-50 border-emerald-100 text-emerald-800",
      dot: "bg-emerald-400",
      highlight: "text-emerald-700"
    },
    {
      container: "bg-sky-50 border-sky-100 text-sky-800",
      dot: "bg-sky-400",
      highlight: "text-sky-700"
    },
    {
      container: "bg-violet-50 border-violet-100 text-violet-800",
      dot: "bg-violet-400",
      highlight: "text-violet-700"
    },
    {
      container: "bg-rose-50 border-rose-100 text-rose-800",
      dot: "bg-rose-400",
      highlight: "text-rose-700"
    }
  ];
  const feedbackStyles: Record<string, { badge: string; panel: string; text: string }> = {
    grammar: { badge: "bg-rose-100 text-rose-700 border-rose-200", panel: "bg-rose-50/70 border-rose-100/80", text: "text-rose-800" },
    spelling: { badge: "bg-amber-100 text-amber-700 border-amber-200", panel: "bg-amber-50/70 border-amber-100/80", text: "text-amber-800" },
    vocabulary: { badge: "bg-violet-100 text-violet-700 border-violet-200", panel: "bg-violet-50/70 border-violet-100/80", text: "text-violet-800" },
    structure: { badge: "bg-sky-100 text-sky-700 border-sky-200", panel: "bg-sky-50/70 border-sky-100/80", text: "text-sky-800" },
    pronunciation: { badge: "bg-emerald-100 text-emerald-700 border-emerald-200", panel: "bg-emerald-50/70 border-emerald-100/80", text: "text-emerald-800" },
    general: { badge: "bg-indigo-100 text-indigo-700 border-indigo-200", panel: "bg-indigo-50/70 border-indigo-100/80", text: "text-indigo-800" }
  };
  const isArabicText = (text?: string) => !!text && /[\u0600-\u06FF]/.test(text);
  const highlightTerm = (text: string, term: string, className: string) => {
    if (!text || !term) return text;
    const index = text.indexOf(term);
    if (index === -1) return text;
    const before = text.slice(0, index);
    const after = text.slice(index + term.length);
    return (
      <>
        {before}
        <span className={clsx("font-bold", className)}>{term}</span>
        {after}
      </>
    );
  };

  const handlePlayToggle = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isPlaying) {
      onStop();
    } else {
      onPlay(message.id);
    }
  };

  // User Message Bubble
  if (!isBot) {
    return (
      <div className="flex justify-end mb-6 group animate-fade-in-up">
        <div className="relative max-w-[90%] sm:max-w-[75%]">
           <div className="bg-gradient-to-br from-primary to-teal-600 text-white rounded-2xl rounded-tr-sm px-4 sm:px-6 py-3 sm:py-4 shadow-md shadow-primary/10 border border-white/10 relative overflow-hidden transition-transform hover:scale-[1.01] duration-300">
             {/* Subtle noise texture */}
             <div className="absolute inset-0 opacity-5 bg-black mix-blend-overlay pointer-events-none"></div>
             
             <p className="text-base sm:text-lg leading-relaxed font-sans font-medium relative z-10">{message.transcript?.transcript}</p>
             {/* Only show transliteration if it's available and not redundant */}
             {message.transcript?.transliteration && message.transcript.transliteration !== message.transcript.transcript && (
                <p className="text-sm text-teal-100/90 mt-2 italic font-light border-t border-white/20 pt-2 inline-block relative z-10 font-serif">
                  {message.transcript.transliteration}
                </p>
             )}
           </div>
           {/* Tiny tail hint */}
           <div className="absolute top-0 -right-1 w-2 h-2 bg-teal-600 rounded-bl-full"></div>
        </div>
      </div>
    );
  }

  // Bot Message Bubble
  const data = message.content;
  if (!data) return null;

  return (
    <div className="flex justify-start mb-8 animate-fade-in-up">
      {/* Container - Premium Glass Card */}
      <div className="max-w-[96%] sm:max-w-[90%] w-full bg-white/90 backdrop-blur-md border border-stone-100 rounded-[2rem] rounded-tl-sm p-1 shadow-sm ring-1 ring-black/5 relative overflow-hidden group">
        
        {/* Soft background ambient gradient */}
        <div className="absolute top-0 right-0 w-2/3 h-2/3 bg-gradient-radial from-amber-50/60 to-transparent opacity-60 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-2/3 h-2/3 bg-gradient-radial from-primary/5 to-transparent opacity-60 pointer-events-none"></div>

        <div className="p-4 sm:p-8 relative z-10">
          {/* Header Row */}
          <div className="flex items-center justify-between mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-stone-100/80">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-primary-soft to-white flex items-center justify-center text-primary border border-white shadow-sm">
                  <Bot size={18} />
               </div>
               <div>
                <span className="block text-xs sm:text-sm font-bold text-text-strong">LingoPal</span>
                 <span className="block text-[10px] text-text-muted font-bold uppercase tracking-wider">AI Tutor</span>
               </div>
               {data.rephraseStyle && (
                 <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border border-stone-200 bg-white/70 text-text-muted">
                   Rephrase · {data.rephraseStyle}
                 </span>
               )}
            </div>
            
            {message.audioUrl && (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <button 
                  onClick={handlePlayToggle}
                  className={clsx(
                    "relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 shadow-sm hover:shadow-md active:scale-95",
                    isPlaying 
                      ? "bg-secondary text-white" 
                      : "bg-white text-text-main border border-stone-200 hover:border-primary hover:text-primary"
                  )}
                  aria-label={isPlaying ? "Pause audio" : "Play audio"}
                >
                  {isPlaying ? (
                    <Pause size={16} fill="currentColor" />
                  ) : (
                    <Play size={16} className="ml-0.5 fill-current" />
                  )}
                </button>
                <button
                  onClick={() => onPlaySlow(message.id)}
                  className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest rounded-full border border-stone-200 bg-white/80 text-text-muted hover:text-primary hover:border-primary/30 transition-colors"
                  aria-label="Play slow"
                >
                  Slow
                </button>
              </div>
            )}
          </div>

          {/* Content Stack */}
          <div className="space-y-6 sm:space-y-7">
            
            {/* 1. Correction Feedback (Conditional) */}
            {data.feedback && data.feedback.hasError && (
              <div
                className={clsx(
                  "rounded-2xl p-5 border relative overflow-hidden",
                  feedbackStyles[data.feedback.type || 'general'].panel
                )}
              >
                 <div className="flex items-start gap-3 relative z-10">
                    <div className="p-1.5 bg-white rounded-lg mt-0.5 border border-white/60">
                      <Sparkles size={14} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={clsx("text-[10px] font-bold uppercase tracking-widest", feedbackStyles[data.feedback.type || 'general'].text)}>Correction</span>
                        {data.feedback.type && (
                          <span
                            className={clsx(
                              "text-[10px] font-bold px-1.5 py-0.5 rounded-md border capitalize",
                              feedbackStyles[data.feedback.type || 'general'].badge
                            )}
                          >
                            {data.feedback.type}
                          </span>
                        )}
                      </div>
                      <div className="grid gap-2">
                        <div className="bg-white/70 rounded-xl p-3 border border-white/80">
                          <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted mb-1">Your phrase</span>
                          <p className={clsx("font-semibold", isRTL ? "font-arabic" : "font-sans")} dir={isRTL ? "rtl" : "ltr"}>
                            {data.userTranscript}
                          </p>
                        </div>
                        {data.feedback.correction && (
                          <div className="bg-white/70 rounded-xl p-3 border border-white/80">
                            <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted mb-1">Correct</span>
                            <p className={clsx("font-semibold", feedbackStyles[data.feedback.type || 'general'].text, isRTL ? "font-arabic" : "font-sans")} dir={isRTL ? "rtl" : "ltr"}>
                              {data.feedback.correction}
                            </p>
                          </div>
                        )}
                      </div>
                      {data.feedback.explanation && (
                        <p className={clsx("text-sm leading-relaxed mt-2", feedbackStyles[data.feedback.type || 'general'].text)}>
                          {data.feedback.explanation}
                        </p>
                      )}
                    </div>
                 </div>
              </div>
            )}

            {/* 2. Target Text (Hero) */}
            <div className="text-center px-1 sm:px-2">
              <p 
                className={clsx(
                  "text-2xl sm:text-4xl font-extrabold leading-[1.6] text-text-strong drop-shadow-sm transition-colors",
                  isRTL ? "font-arabic leading-[2.2]" : "font-sans"
                )} 
                dir={isRTL ? "rtl" : "ltr"}
              >
                {data.targetText}
              </p>
            </div>

            {/* Rephrase Actions */}
            <div className="flex flex-wrap justify-center gap-2">
              {(['natural', 'casual', 'formal'] as const).map(style => (
                <button
                  key={style}
                  onClick={() => onRephrase(message.id, style)}
                  className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest px-3 py-2 rounded-full border border-stone-200 bg-white/80 text-text-muted hover:text-primary hover:border-primary/30 transition-colors"
                >
                  Rephrase {style}
                </button>
              ))}
            </div>

            {/* 3. Translation / Transcription Card (Paper Style) */}
            <div className="bg-gradient-to-br from-primary/5 via-white to-secondary/5 rounded-2xl p-4 sm:p-6 border border-primary/10 relative group/trans hover:from-primary/10 hover:to-secondary/10 transition-colors">
               <button 
                  onClick={() => navigator.clipboard.writeText(targetLanguage === 'English' ? data.userTranscript : data.englishTranslation)}
                  className="absolute top-3 right-3 text-stone-300 hover:text-stone-500 transition-colors opacity-0 group-hover/trans:opacity-100"
                  title="Copy Text"
               >
                  <Copy size={14} />
               </button>
               <div className="space-y-3 text-center">
                 <span className="block text-[10px] font-bold text-text-muted uppercase tracking-[0.2em]">
                   {targetLanguage === 'English' ? 'Your Transcript' : 'English Meaning'}
                 </span>
                 {/* Only show transliteration if distinct from target (e.g. Arabic) and exists */}
                 {isRTL && data.transliteration && (
                   <>
                     <p className="text-secondary font-serif italic text-lg opacity-90">{data.transliteration}</p>
                     <div className="w-8 h-px bg-stone-200 mx-auto"></div>
                   </>
                 )}
                <p className="text-text-main font-semibold text-base sm:text-lg">
                   {targetLanguage === 'English' ? data.userTranscript : data.englishTranslation}
                 </p>
               </div>
            </div>

            {/* 4. Vocabulary (Chips) */}
            {data.vocabulary.length > 0 && (
              <div>
                <span className="block text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mb-3 text-center">Key Vocabulary</span>
                <div className="flex flex-wrap justify-center gap-2">
                  {data.vocabulary.map((vocab, idx) => {
                    const styleIndex = idx % vocabStyles.length;
                    const style = vocabStyles[styleIndex];
                    return (
                      <div
                        key={idx}
                        className={clsx(
                          "group border shadow-sm rounded-xl pl-2 pr-2 py-2 flex items-center gap-2 transition-all",
                          style.container
                        )}
                      >
                        <button
                          onClick={() => setSelectedVocab({ vocab, styleIndex })}
                          className="flex items-center gap-2"
                        >
                          <span className={clsx("w-1.5 h-1.5 rounded-full", style.dot)}></span>
                        <span className={clsx("font-bold text-base sm:text-lg", isRTL ? "font-arabic" : "font-sans")}>{vocab.term}</span>
                          <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">{vocab.meaning}</span>
                        </button>
                        <button
                          onClick={() => onSpeakVocab(vocab.term)}
                          className="ml-1 p-1.5 rounded-full bg-white/80 border border-white/70 text-text-muted hover:text-primary transition-colors"
                          aria-label="Play pronunciation"
                          title="Play pronunciation"
                        >
                          <Volume2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. Cultural Notes (Golden Sidebar) */}
            {data.culturalNotes.length > 0 && (
              <div className="bg-gradient-to-r from-amber-50/60 to-transparent rounded-r-2xl border-l-[3px] border-amber-400 p-5 relative overflow-hidden">
                <span className="block text-[10px] font-bold text-amber-600/80 uppercase tracking-[0.2em] mb-2">Cultural Insight</span>
                <ul className="space-y-2">
                  {data.culturalNotes.map((note, i) => (
                    <li key={i} className="text-sm text-text-main leading-relaxed flex gap-2">
                       <span className="text-amber-400 mt-1.5">•</span>
                       <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Vocab Detail Modal */}
      {selectedVocab && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/20 backdrop-blur-sm animate-in fade-in duration-200" 
          onClick={() => setSelectedVocab(null)}
        >
          <div 
            className="bg-white rounded-[2rem] shadow-2xl p-8 max-w-sm w-full animate-in zoom-in-95 duration-200 relative overflow-hidden border border-white/60 ring-1 ring-white" 
            onClick={e => e.stopPropagation()}
          >
            <button onClick={() => setSelectedVocab(null)} className="absolute top-4 right-4 p-2 text-stone-300 hover:text-stone-600 transition-colors">
                <X size={20} />
            </button>
            
            <div className="text-center space-y-4 pt-2">
              <h4 className={clsx("text-4xl font-extrabold text-text-strong", isRTL ? "font-arabic" : "font-sans")}>{selectedVocab.vocab.term}</h4>
              {isRTL && selectedVocab.vocab.transliteration && (
                <p className="text-lg text-secondary font-serif italic">{selectedVocab.vocab.transliteration}</p>
              )}
              
              <div className="bg-stone-50 rounded-2xl p-5 border border-stone-100 mt-4">
                <p className="font-bold text-text-main text-lg mb-2">{selectedVocab.vocab.meaning}</p>
                <span className="inline-block px-2 py-1 bg-stone-200/50 rounded text-[10px] font-bold text-text-muted uppercase tracking-widest border border-stone-200">
                  {selectedVocab.vocab.partOfSpeech}
                </span>
              </div>
              <button
                onClick={() => onSpeakVocab(selectedVocab.vocab.term)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-stone-200 bg-white/80 text-text-muted hover:text-primary hover:border-primary/30 transition-colors text-xs font-bold uppercase tracking-widest"
              >
                <Volume2 size={14} />
                Listen
              </button>

              {(selectedVocab.vocab.exampleSource || selectedVocab.vocab.exampleTarget) && (
                <div className="space-y-3">
                  {selectedVocab.vocab.exampleSource && (
                    <div className="bg-white rounded-2xl p-4 border border-stone-100 text-left">
                      <span className="block text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mb-1">
                        Source Example
                      </span>
                      <p
                        className="text-text-main font-medium"
                        dir={isArabicText(selectedVocab.vocab.exampleSource) ? "rtl" : "ltr"}
                      >
                        {highlightTerm(
                          selectedVocab.vocab.exampleSource,
                          selectedVocab.vocab.sourceTerm || selectedVocab.vocab.term,
                          vocabStyles[selectedVocab.styleIndex].highlight
                        )}
                      </p>
                    </div>
                  )}
                  {selectedVocab.vocab.exampleTarget && (
                    <div className="bg-white rounded-2xl p-4 border border-stone-100 text-left">
                      <span className="block text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mb-1">
                        Target Example
                      </span>
                      <p
                        className={clsx("text-text-main font-medium", isRTL ? "font-arabic" : "font-sans")}
                        dir={isRTL ? "rtl" : "ltr"}
                      >
                        {highlightTerm(
                          selectedVocab.vocab.exampleTarget,
                          selectedVocab.vocab.term,
                          vocabStyles[selectedVocab.styleIndex].highlight
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
