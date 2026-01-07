
import React, { useState, useEffect } from 'react';

interface RoomControlsProps {
  isLocked: boolean;
  setIsLocked: (locked: boolean) => void;
  onLeave?: () => void;
  micActive: boolean;
  videoActive: boolean;
  toggleMic: () => void;
  toggleVideo: () => void;
  isHost?: boolean;
}

const RoomControls: React.FC<RoomControlsProps> = ({ 
  isLocked, 
  setIsLocked, 
  onLeave,
  micActive,
  videoActive,
  toggleMic,
  toggleVideo,
  isHost
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    let timeout: number;
    const handleActivity = () => {
      setIsVisible(true);
      if (timeout) clearTimeout(timeout);
      timeout = window.setTimeout(() => setIsVisible(false), 3000);
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    handleActivity();

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  return (
    <div className={`fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-fit px-4 transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
      <div className="glass p-2 sm:p-3 rounded-[2rem] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center gap-2 sm:gap-4 pointer-events-auto">
        <div className="flex items-center gap-2">
          <button onClick={toggleMic} className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${micActive ? 'bg-indigo-600 text-white' : 'bg-red-500/20 text-red-500 border border-red-500/20'}`}>
            <i className={`fas ${micActive ? 'fa-microphone' : 'fa-microphone-slash'}`}></i>
          </button>
          <button onClick={toggleVideo} className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${videoActive ? 'bg-indigo-600 text-white' : 'bg-red-500/20 text-red-500 border border-red-500/20'}`}>
            <i className={`fas ${videoActive ? 'fa-video' : 'fa-video-slash'}`}></i>
          </button>
        </div>

        <div className="h-8 w-[1px] bg-white/10 shrink-0"></div>

        {isHost && (
          <button onClick={() => setIsLocked(!isLocked)} className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${isLocked ? 'bg-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-white/5 text-slate-400'}`}>
            <i className={`fas ${isLocked ? 'fa-lock' : 'fa-lock-open'}`}></i>
          </button>
        )}

        <div className="h-8 w-[1px] bg-white/10 shrink-0"></div>

        <button 
          onClick={onLeave}
          className="h-10 px-4 sm:px-6 rounded-2xl text-[10px] font-black transition-all flex items-center gap-3 uppercase tracking-widest border border-red-500/20 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white shadow-xl"
        >
          <i className="fas fa-power-off"></i>
          <span className="hidden sm:inline">{isHost ? "End Session" : "Leave"}</span>
        </button>
      </div>
    </div>
  );
};

export default RoomControls;
