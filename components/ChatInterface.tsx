import { useEffect, useRef } from 'react';
import { Message } from '../types';
import ChatMessage from './ChatMessage';

interface ChatInterfaceProps {
  messages: Message[];
  isLoading: boolean;
  playbackSpeed: number;
  currentlyPlayingId: string | null;
  onPlay: (id: string) => void;
  onPlaySlow: (id: string) => void;
  onStop: () => void;
  targetLanguage: string;
  onRephrase: (messageId: string, style: 'natural' | 'casual' | 'formal') => void;
  onSpeakVocab: (term: string) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  isLoading,
  playbackSpeed,
  currentlyPlayingId,
  onPlay,
  onPlaySlow,
  onStop,
  targetLanguage,
  onRephrase,
  onSpeakVocab
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto px-3 sm:px-6 w-full max-w-xl md:max-w-2xl mx-auto scroll-smooth no-scrollbar pb-28 sm:pb-36 mask-image-b">
      
      {messages.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center space-y-8 sm:space-y-10 animate-fade-in-up pb-8 sm:pb-10">
          
          {/* Hero Emoji & Halo */}
          <div className="relative">
            {/* Breathing Halo */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 sm:w-48 sm:h-48 bg-primary-glow/20 rounded-full blur-3xl animate-breathe"></div>
            
            <div className="relative w-28 h-28 sm:w-36 sm:h-36 bg-gradient-to-b from-white to-stone-50 rounded-full shadow-gem flex items-center justify-center border border-white/60 backdrop-blur-sm animate-float">
              <span className="text-6xl sm:text-7xl drop-shadow-sm animate-wave origin-bottom-right cursor-default select-none">👋</span>
            </div>
          </div>
          
          {/* Text Block */}
          <div className="max-w-sm space-y-3 relative z-10">
            <h3 className="text-4xl sm:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary via-secondary to-primary font-sans tracking-tight pb-2 leading-tight animate-pulse-slow">
              LingoPal
            </h3>
            <p className="text-primary font-medium tracking-wide text-base sm:text-lg">
              Your partner in mastering languages.
            </p>
             <span className="inline-block px-3 py-1 bg-secondary/10 text-secondary text-xs font-bold uppercase tracking-widest rounded-full border border-secondary/20">
               Learning: {targetLanguage}
             </span>
            <p className="text-text-muted text-xs sm:text-sm pt-3 sm:pt-4">
              Tap the button below to start conversation.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-8 pt-4">
          {messages.map((msg, index) => (
            <div key={msg.id} className="animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
              <ChatMessage
                message={msg}
                playbackSpeed={playbackSpeed}
                currentlyPlayingId={currentlyPlayingId}
                onPlay={onPlay}
                onPlaySlow={onPlaySlow}
                onStop={onStop}
                targetLanguage={targetLanguage}
                onRephrase={onRephrase}
                onSpeakVocab={onSpeakVocab}
              />
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start animate-fade-in-up">
              <div className="bg-white/80 backdrop-blur px-5 py-4 rounded-3xl rounded-tl-sm shadow-soft border border-white/60 flex items-center gap-3">
                 <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                 <span className="text-sm text-text-soft font-medium font-sans">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
};

export default ChatInterface;