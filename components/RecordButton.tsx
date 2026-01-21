import { Mic, Square } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

interface RecordButtonProps {
  isRecording: boolean;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
  volumeLevel?: number; // 0.0 to 1.0
}

const RecordButton: React.FC<RecordButtonProps> = ({ 
  isRecording, 
  onStart, 
  onStop, 
  disabled,
  volumeLevel = 0 
}) => {
  // Reactive Visualizer
  const glowScale = isRecording ? 1 + (volumeLevel * 0.5) : 1;

  return (
    <div className="flex flex-col items-center gap-5 sm:gap-6 relative group">
      
      {/* Ambient Halo / Volume Reactor */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
         {/* Deep Glow */}
        <div 
          className={twMerge(
            "w-28 h-28 sm:w-32 sm:h-32 rounded-full transition-all duration-75 ease-linear blur-2xl opacity-40",
            isRecording ? "bg-rose-500" : "bg-primary-glow"
          )}
           style={{ 
             transform: isRecording ? `scale(${glowScale * 1.3})` : 'scale(1)',
             opacity: isRecording ? 0.6 : 0.2
           }}
         />
         {/* Sharp Pulse Ring */}
        <div 
          className={twMerge(
            "absolute w-24 h-24 sm:w-28 sm:h-28 rounded-full border border-white/50 transition-all duration-75 ease-linear",
            isRecording ? "opacity-100 border-rose-300" : "opacity-0"
          )}
           style={{ 
             transform: `scale(${glowScale * 1.1})`,
           }}
         />
      </div>

      <button
        type="button"
        onClick={isRecording ? onStop : onStart}
        disabled={disabled}
        aria-label={isRecording ? "Stop recording" : "Start recording"}
        className={twMerge(
          "relative z-10 flex items-center justify-center w-24 h-24 sm:w-28 sm:h-28 rounded-full transition-all duration-500 transform shadow-2xl focus:outline-none",
          isRecording 
            ? "bg-gradient-to-br from-rose-500 to-orange-600 shadow-rose-500/40 scale-100" 
            : "bg-gradient-to-br from-primary via-primary-hover to-teal-900 shadow-primary/40 animate-breathe hover:scale-105",
          disabled && "opacity-50 grayscale cursor-not-allowed transform-none hover:scale-100 animate-none"
        )}
      >
        {/* Gemstone Effect Layers */}
        
        {/* 1. Caustic Reflection (Top) */}
        <div className="absolute inset-x-6 top-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent rounded-full opacity-90 blur-[1px] pointer-events-none" />
        
        {/* 2. Inner Glow (Bottom) */}
        <div className="absolute inset-0 rounded-full shadow-[inset_0_-8px_16px_rgba(0,0,0,0.3)] pointer-events-none" />
        
        {/* 3. Glass Rim */}
        <div className="absolute inset-0 rounded-full border-4 border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] pointer-events-none" />

        {/* Icon Container */}
        <div className={twMerge(
          "relative z-20 transition-all duration-300 filter drop-shadow-md text-white",
          isRecording ? "scale-90" : "scale-100"
        )}>
          {isRecording ? (
            <Square className="w-9 h-9 sm:w-10 sm:h-10 fill-current animate-pulse" />
          ) : (
            <Mic className="w-10 h-10 sm:w-12 sm:h-12 drop-shadow-lg" strokeWidth={1.5} />
          )}
        </div>
      </button>

      {/* Floating Label */}
      <span className={twMerge(
        "text-[9px] sm:text-[10px] font-bold tracking-[0.2em] uppercase transition-all duration-300 bg-white/60 backdrop-blur-xl px-3 sm:px-4 py-1.5 rounded-full border border-white/50 shadow-sm",
        isRecording ? "text-rose-500 border-rose-100 translate-y-2" : "text-text-muted border-stone-100"
      )}>
        {isRecording ? "Listening..." : "Tap to Speak"}
      </span>
    </div>
  );
};

export default RecordButton;