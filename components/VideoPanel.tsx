
import React, { useEffect, useRef } from 'react';
import { User } from '../types';

interface VideoPanelProps {
  participants: User[];
  localStream: MediaStream | null;
  compact?: boolean;
  isHost?: boolean;
  onMute?: (id: string) => void;
  onRemove?: (id: string) => void;
}

const VideoPanel: React.FC<VideoPanelProps> = ({ 
  participants, 
  localStream, 
  compact, 
  isHost, 
  onMute, 
  onRemove 
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 overflow-x-auto h-full custom-scrollbar min-h-0">
        {participants.map((p, idx) => {
          const isMe = p.id === participants[0].id;
          return (
            <div key={p.id} className="relative h-full aspect-video bg-[#121218] rounded-2xl overflow-hidden border border-white/5 shadow-lg group shrink-0">
              {isMe ? (
                <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover mirror bg-black" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center" style={{ backgroundColor: p.color + '15' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white" style={{ backgroundColor: p.color }}>
                    {p.name.charAt(0)}
                  </div>
                </div>
              )}
              <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 px-2 py-1 rounded-lg">
                <div className={`w-1.5 h-1.5 rounded-full ${p.isMuted ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                <span className="text-[7px] font-black text-white uppercase truncate max-w-[50px]">{isMe ? 'You' : p.name}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6 pb-24">
      {participants.map((p, idx) => {
        const isMe = p.id === participants[0].id;
        return (
          <div key={p.id} className="relative aspect-video bg-[#0e0e12] rounded-[1.5rem] md:rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl group transition-all duration-300 hover:border-indigo-500/30">
            {isMe ? (
              <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover mirror bg-black" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center" style={{ backgroundColor: p.color + '05' }}>
                 <div className="w-12 h-12 md:w-20 md:h-20 rounded-[1.5rem] md:rounded-[2.5rem] flex items-center justify-center text-xl md:text-3xl font-black text-white shadow-2xl transition-transform group-hover:scale-110" style={{ backgroundColor: p.color }}>
                   {p.name.charAt(0)}
                 </div>
                 <span className="mt-2 md:mt-4 text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest">{p.name}</span>
              </div>
            )}
            
            <div className="absolute bottom-2 md:bottom-4 left-2 md:left-4 flex items-center gap-1 md:gap-2 bg-black/60 backdrop-blur-md px-2 md:px-3 py-1 md:py-1.5 rounded-xl md:rounded-2xl border border-white/10">
              <div className={`w-1.5 md:w-2 h-1.5 md:h-2 rounded-full ${p.isMuted ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
              <span className="text-[8px] md:text-[10px] font-black text-white uppercase tracking-widest truncate max-w-[60px] md:max-w-none">
                {isMe ? 'You' : p.name} {p.role === 'host' ? '(Host)' : ''}
              </span>
            </div>
            
            {isHost && !isMe && (
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 md:gap-4 transition-all duration-300">
                 <button onClick={() => onMute?.(p.id)} className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl transition-all flex items-center justify-center ${p.isMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                   <i className={`fas ${p.isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
                 </button>
                 <button onClick={() => onRemove?.(p.id)} className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-red-500/20 hover:bg-red-500 text-white flex items-center justify-center border border-red-500/30">
                   <i className="fas fa-user-minus"></i>
                 </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default VideoPanel;
