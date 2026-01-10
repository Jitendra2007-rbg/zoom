
import React, { useEffect, useRef, useState } from 'react';
import { User } from '../types';

interface VideoPanelProps {
  participants: User[];
  localStream: MediaStream | null;
  remoteStreams?: Record<string, MediaStream>;
  currentUser: User;
  hostId: string | null;
  compact?: boolean;
}

const VolumeVisualizer: React.FC<{ stream: MediaStream | null }> = ({ stream }) => {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) {
      setLevel(0);
      return;
    }
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        setLevel(avg > 25 ? (avg / 128) : 0);
        requestAnimationFrame(checkVolume);
      };
      const rafId = requestAnimationFrame(checkVolume);

      return () => {
        cancelAnimationFrame(rafId);
        audioContext.close();
      };
    } catch (e) {
      console.error("Audio analyzer failed", e);
    }
  }, [stream]);

  if (level <= 0.05) return null;

  return (
    <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden rounded-[2rem]">
      <div 
        className="absolute inset-0 border-[6px] border-indigo-500/60 rounded-[2rem] transition-all duration-75"
        style={{ 
          boxShadow: `inset 0 0 ${level * 60}px rgba(99, 102, 241, 0.8), 0 0 ${level * 40}px rgba(99, 102, 241, 0.4)`,
          transform: `scale(${1 + (level * 0.05)})`,
        }}
      />
      <div className="absolute bottom-12 right-6 flex items-end gap-1 h-8">
        {[0, 1, 2].map(i => (
          <div 
            key={i} 
            className="w-1.5 bg-indigo-400 rounded-full transition-all duration-75" 
            style={{ height: `${Math.random() * level * 100}%`, minHeight: '4px' }} 
          />
        ))}
      </div>
    </div>
  );
};

const VideoFrame: React.FC<{ stream: MediaStream | null; user: User; isMe: boolean; isHost: boolean; compact?: boolean }> = ({ stream, user, isMe, isHost, compact }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) {
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play().catch(err => {
          console.warn("Autoplay was blocked", err);
          // Retry playback on user interaction if needed
        });
      };
    }
  }, [stream]);

  const hasVideo = stream && stream.getVideoTracks().length > 0 && stream.getVideoTracks().some(t => t.enabled);

  return (
    <div className={`relative ${compact ? 'h-full aspect-video shrink-0' : 'aspect-video w-full'} bg-[#0e0e12] rounded-3xl border border-white/10 overflow-hidden shadow-2xl transition-all duration-300`}>
      <VolumeVisualizer stream={stream} />
      
      {hasVideo ? (
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted={isMe} 
          className={`w-full h-full object-cover ${isMe ? 'scale-x-[-1]' : ''} bg-black`} 
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900/50">
          <div className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-3xl font-black text-white shadow-2xl transition-transform duration-500" style={{ backgroundColor: user.color }}>
            {user.name.charAt(0)}
          </div>
          <span className="mt-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            {stream ? 'Camera Off' : 'Connecting...'}
          </span>
          {/* Even if video is off, we still need to play the audio stream */}
          <video ref={videoRef} autoPlay playsInline muted={isMe} className="hidden" />
        </div>
      )}

      <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/10 z-20">
        <div className={`w-2 h-2 rounded-full ${stream ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
        <span className="text-[10px] font-black text-white uppercase tracking-widest truncate max-w-[100px]">
          {isMe ? 'You' : user.name} {isHost ? <span className="text-indigo-400 ml-1">(Host)</span> : ''}
        </span>
      </div>
    </div>
  );
};

const VideoPanel: React.FC<VideoPanelProps> = ({ participants, localStream, remoteStreams = {}, currentUser, hostId, compact }) => {
  // Use a map to handle duplicates and ensure we always show the current session's people
  const uniqueParticipants = Array.from(new Map(participants.map(p => [p.id, p])).values());

  return (
    <div className={`${compact ? 'flex items-center gap-4 px-4 h-full overflow-x-auto custom-scrollbar' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'}`}>
      {uniqueParticipants.map((p) => {
        const isMe = p.id === currentUser.id;
        const isHost = p.id === hostId;
        const stream = isMe ? localStream : (remoteStreams[p.id] || null);

        return (
          <VideoFrame 
            key={p.id} 
            user={p} 
            isMe={isMe} 
            isHost={isHost}
            stream={stream} 
            compact={compact}
          />
        );
      })}
    </div>
  );
};

export default VideoPanel;
