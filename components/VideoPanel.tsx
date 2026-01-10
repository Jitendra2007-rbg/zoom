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
      console.error("Visualizer error", e);
    }
  }, [stream]);

  if (level <= 0.05) return null;

  return (
    <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden rounded-[2rem]">
      <div 
        className="absolute inset-0 border-[4px] border-indigo-500/40 rounded-[2rem] transition-all duration-75"
        style={{ 
          boxShadow: `inset 0 0 ${level * 40}px rgba(99, 102, 241, 0.6)`,
        }}
      />
    </div>
  );
};

const VideoFrame: React.FC<{ stream: MediaStream | null; user: User; isMe: boolean; isHost: boolean; compact?: boolean }> = ({ stream, user, isMe, isHost, compact }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) {
      console.log(`Setting stream for ${user.name}`, stream.id);
      video.srcObject = stream;
      
      const playVideo = async () => {
        try {
          await video.play();
        } catch (err) {
          console.warn("Autoplay prevented, will play on next user interaction", err);
          // Add a one-time click listener to play all remote streams if blocked
          const resume = () => {
             video.play().catch(() => {});
             window.removeEventListener('click', resume);
          };
          window.addEventListener('click', resume);
        }
      };

      video.onloadedmetadata = () => {
        playVideo();
      };
    }
  }, [stream, user.name]);

  const hasVideo = stream && stream.getVideoTracks().length > 0 && stream.getVideoTracks().some(t => t.enabled);

  return (
    <div className={`relative ${compact ? 'h-full aspect-video shrink-0' : 'aspect-video w-full'} bg-[#0e0e12] rounded-[1.5rem] md:rounded-3xl border border-white/10 overflow-hidden shadow-2xl group transition-all`}>
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
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl flex items-center justify-center text-xl md:text-3xl font-black text-white shadow-2xl" style={{ backgroundColor: user.color }}>
            {user.name.charAt(0)}
          </div>
          <span className="mt-4 text-[9px] font-black text-slate-500 uppercase tracking-widest opacity-60">
            {stream ? 'Camera Inactive' : 'Buffering...'}
          </span>
          {/* Audio must still play if camera is off */}
          <video ref={videoRef} autoPlay playsInline muted={isMe} className="hidden" />
        </div>
      )}

      <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 z-20">
        <div className={`w-1.5 h-1.5 rounded-full ${stream ? 'bg-indigo-500 animate-pulse' : 'bg-red-500'}`}></div>
        <span className="text-[9px] font-black text-white uppercase tracking-tighter truncate max-w-[80px]">
          {isMe ? 'Local' : user.name} {isHost ? '★' : ''}
        </span>
      </div>
    </div>
  );
};

const VideoPanel: React.FC<VideoPanelProps> = ({ participants, localStream, remoteStreams = {}, currentUser, hostId, compact }) => {
  // Fix: Explicitly provide generics to the Map constructor to ensure correct User[] inference for unique participants and resolve the unknown type assignment error.
  const uniqueParticipants: User[] = Array.from(new Map<string, User>(participants.map(p => [p.id, p])).values());

  return (
    <div className={`${compact ? 'flex items-center gap-4 px-2 h-full overflow-x-auto custom-scrollbar' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'}`}>
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