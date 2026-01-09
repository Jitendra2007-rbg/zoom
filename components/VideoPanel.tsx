
import React, { useEffect, useRef, useState } from 'react';
import { User } from '../types';

interface VideoPanelProps {
  participants: User[];
  localStream: MediaStream | null;
  remoteStreams?: Record<string, MediaStream>;
  compact?: boolean;
  isHost?: boolean;
}

const VolumeVisualizer: React.FC<{ stream: MediaStream | null }> = ({ stream }) => {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!stream) return;
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 64;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const checkVolume = () => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const avg = sum / dataArray.length;
      setLevel(avg > 20 ? (avg / 128) : 0);
      requestAnimationFrame(checkVolume);
    };
    checkVolume();

    return () => audioContext.close();
  }, [stream]);

  return (level > 0.1) ? (
    <div 
      className="absolute inset-0 border-4 border-indigo-500 rounded-[2rem] animate-pulse" 
      style={{ boxShadow: `0 0 ${level * 50}px rgba(99, 102, 241, 0.6)`, opacity: level }}
    />
  ) : null;
};

const VideoFrame: React.FC<{ stream: MediaStream | null; user: User; isMe: boolean; compact?: boolean }> = ({ stream, user, isMe, compact }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={`relative ${compact ? 'h-full aspect-video shrink-0' : 'aspect-video w-full'} bg-[#0e0e12] rounded-3xl border border-white/10 overflow-hidden shadow-2xl`}>
      <VolumeVisualizer stream={stream} />
      {stream ? (
        <video ref={videoRef} autoPlay playsInline muted={isMe} className={`w-full h-full object-cover ${isMe ? 'mirror' : ''} bg-black`} />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center" style={{ backgroundColor: user.color + '15' }}>
          <div className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-3xl font-black text-white" style={{ backgroundColor: user.color }}>
            {user.name.charAt(0)}
          </div>
        </div>
      )}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/10">
        <div className={`w-2 h-2 rounded-full ${stream ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
        <span className="text-[10px] font-black text-white uppercase tracking-widest">{isMe ? 'You' : user.name} {user.role === 'host' ? '(Host)' : ''}</span>
      </div>
    </div>
  );
};

const VideoPanel: React.FC<VideoPanelProps> = ({ participants, localStream, remoteStreams = {}, compact }) => {
  return (
    <div className={`${compact ? 'flex items-center gap-4 px-4 h-full overflow-x-auto custom-scrollbar' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'}`}>
      {participants.map((p, idx) => (
        <VideoFrame 
          key={p.id} 
          user={p} 
          isMe={idx === 0} 
          stream={idx === 0 ? localStream : (remoteStreams[p.id] || null)} 
          compact={compact}
        />
      ))}
    </div>
  );
};

export default VideoPanel;
