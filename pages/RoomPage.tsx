
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { User, Role, Language, SignalingMessage } from '../types';
import EditorPanel from '../components/EditorPanel';
import VideoPanel from '../components/VideoPanel';
import ChatPanel from '../components/ChatPanel';
import RoomControls from '../components/RoomControls';
import Sidebar, { TabType } from '../components/Sidebar';
import Whiteboard from '../components/Whiteboard';
import FilePanel from '../components/FilePanel';
import { supabase, syncRoomState } from '../services/supabase';

interface RoomPageProps {
  user: User;
}

const RoomPage: React.FC<RoomPageProps> = ({ user }) => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  
  const [activeTab, setActiveTab] = useState<TabType>('editor');
  const [participants, setParticipants] = useState<User[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [activeLanguage, setActiveLanguage] = useState<Language>(Language.Javascript);
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [sharedCode, setSharedCode] = useState('');
  const [meetingEnded, setMeetingEnded] = useState(false);
  const [timeLeft, setTimeLeft] = useState(3600);
  const [startTime, setStartTime] = useState<number>(Date.now());

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [micActive, setMicActive] = useState(true);
  const [videoActive, setVideoActive] = useState(true);
  
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
  const [currentRole, setCurrentRole] = useState<Role>('editor');
  const isHost = currentRole === 'host';

  const iceConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // 1. Initialize Room & Role
  useEffect(() => {
    if (!roomId) return;

    const setupRoom = async () => {
      const { data } = await supabase.from('rooms').select('*').eq('id', roomId).single();
      
      let dbParticipants: User[] = data?.participants || [];
      const realHostId = data?.host_id;
      
      const myActualRole: Role = (realHostId === user.id || (!data && queryParams.get('role') === 'host')) ? 'host' : 'editor';
      setCurrentRole(myActualRole);

      if (data?.is_ended) {
        setMeetingEnded(true);
        return;
      }

      if (data?.start_time) {
        setStartTime(data.start_time);
        const duration = data.duration_minutes || 60;
        const elapsed = Math.floor((Date.now() - data.start_time) / 1000);
        setTimeLeft(Math.max(0, (duration * 60) - elapsed));
      }

      const isAlreadyIn = dbParticipants.some(p => p.id === user.id);
      if (!isAlreadyIn) {
        const updatedUser: User = { ...user, role: myActualRole };
        const updatedParticipants = [...dbParticipants, updatedUser];
        
        const payload: any = { participants: updatedParticipants };
        if (myActualRole === 'host' && !data) {
          payload.host_id = user.id;
          payload.title = queryParams.get('title') || 'Untitled Session';
          payload.start_time = Date.now();
          payload.is_ended = false;
          payload.duration_minutes = parseInt(queryParams.get('duration') || '60');
        }
        await syncRoomState(roomId, payload);
        setParticipants(updatedParticipants);
      } else {
        setParticipants(dbParticipants);
      }
      
      if (data) {
        setIsLocked(data.is_locked);
        setSharedCode(data.shared_code || '');
        setActiveLanguage(data.active_language as Language || Language.Javascript);
      }
    };

    setupRoom();

    const roomChannel = supabase
      .channel(`room_db:${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (payload) => {
        const updated = payload.new;
        if (updated.is_ended) {
          setMeetingEnded(true);
          return;
        }
        setIsLocked(updated.is_locked);
        if (updated.participants) setParticipants(updated.participants);
        if (updated.active_language) setActiveLanguage(updated.active_language);
        if (updated.shared_code !== undefined) {
          setSharedCode(updated.shared_code);
        }
      })
      .subscribe();

    const sigChannel = supabase.channel(`sig:${roomId}`);
    
    sigChannel
      .on('broadcast', { event: 'signal' }, async ({ payload }: { payload: SignalingMessage }) => {
        if (payload.to !== user.id) return;
        
        if (payload.type === 'offer') {
          const pc = createPeerConnection(payload.from, sigChannel);
          await pc.setRemoteDescription(new RTCSessionDescription(payload.payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sigChannel.send({
            type: 'broadcast',
            event: 'signal',
            payload: { from: user.id, to: payload.from, type: 'answer', payload: answer }
          });
        } else if (payload.type === 'answer') {
          const pc = peerConnections.current[payload.from];
          if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload.payload));
        } else if (payload.type === 'candidate') {
          const pc = peerConnections.current[payload.from];
          if (pc) await pc.addIceCandidate(new RTCIceCandidate(payload.payload));
        }
      })
      .subscribe();

    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
      setLocalStream(stream);
      
      setTimeout(() => {
        participants.forEach(p => {
          if (p.id !== user.id) {
            const pc = createPeerConnection(p.id, sigChannel, stream);
            pc.createOffer().then(offer => {
              pc.setLocalDescription(offer);
              sigChannel.send({
                type: 'broadcast',
                event: 'signal',
                payload: { from: user.id, to: p.id, type: 'offer', payload: offer }
              });
            });
          }
        });
      }, 1500);
    }).catch(err => {
      console.error("Camera/Mic error", err);
    });

    return () => {
      // Fix: Added explicit type annotation (pc: RTCPeerConnection) to avoid 'unknown' type error during cleanup loop.
      Object.values(peerConnections.current).forEach((pc: RTCPeerConnection) => pc.close());
      localStream?.getTracks().forEach(t => t.stop());
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(sigChannel);
    };
  }, [roomId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const createPeerConnection = (targetId: string, channel: any, stream?: MediaStream) => {
    if (peerConnections.current[targetId]) return peerConnections.current[targetId];

    const pc = new RTCPeerConnection(iceConfig);
    peerConnections.current[targetId] = pc;

    const streamToUse = stream || localStream;
    if (streamToUse) {
      streamToUse.getTracks().forEach(track => pc.addTrack(track, streamToUse));
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        channel.send({
          type: 'broadcast',
          event: 'signal',
          payload: { from: user.id, to: targetId, type: 'candidate', payload: event.candidate }
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStreams(prev => ({ ...prev, [targetId]: event.streams[0] }));
    };

    return pc;
  };

  const handleCodeChange = (code: string) => {
    if (isHost) {
      setSharedCode(code);
      syncRoomState(roomId!, { shared_code: code });
    }
  };

  const handleLeave = async () => {
    if (isHost) {
      if (confirm("End meeting for all participants?")) {
        await syncRoomState(roomId!, { is_ended: true });
        navigate('/dashboard');
      }
    } else {
      const updated = participants.filter(p => p.id !== user.id);
      await syncRoomState(roomId!, { participants: updated });
      navigate('/dashboard');
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (meetingEnded) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#050507] text-white text-center p-4">
        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
          <i className="fas fa-calendar-times text-4xl text-red-500"></i>
        </div>
        <h1 className="text-4xl font-black mb-4 text-red-500 uppercase tracking-tighter">Meeting Concluded</h1>
        <p className="text-slate-400 mb-8 max-w-sm">The host has ended this session for everyone. Thank you for using Codex Collab.</p>
        <button onClick={() => navigate('/dashboard')} className="px-10 py-4 bg-indigo-600 rounded-2xl font-bold hover:bg-indigo-500 transition-all">Go to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#050507] overflow-hidden text-slate-200" style={{ height: 'calc(var(--vh, 1vh) * 100)' }}>
      <header className="h-14 border-b border-white/5 flex items-center justify-between px-4 glass shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
             <i className="fas fa-terminal text-white text-xs"></i>
          </div>
          <span className="font-black text-white text-sm uppercase tracking-tighter">Project <span className="text-indigo-500 ml-1">#{roomId}</span></span>
        </div>

        <div className="flex items-center gap-4">
          <div className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-[10px] font-mono font-black text-indigo-400">
            {formatTime(timeLeft)}
          </div>
          <div className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-[10px] font-black uppercase text-slate-500">
            {isHost ? <span className="text-indigo-400">Host Mode</span> : 'Participant Mode'}
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          <div className="flex-1 min-h-0 overflow-hidden relative bg-[#0b0b0f]">
            {activeTab === 'people' && (
              <div className="h-full overflow-y-auto p-6">
                 <VideoPanel participants={participants} localStream={localStream} remoteStreams={remoteStreams} isHost={isHost} />
              </div>
            )}
            {activeTab === 'editor' && (
              <EditorPanel 
                user={{...user, role: currentRole}} 
                isLocked={isLocked} 
                isPracticeMode={isPracticeMode}
                onLanguageChange={(l) => isHost && syncRoomState(roomId!, { active_language: l })}
                sharedCode={sharedCode}
                onCodeChange={handleCodeChange}
              />
            )}
            {activeTab === 'board' && <Whiteboard />}
            {activeTab === 'files' && <FilePanel roomId={roomId!} currentUser={{...user, role: currentRole}} />}
            {activeTab === 'notes' && <ChatPanel roomId={roomId!} currentUser={{...user, role: currentRole}} participants={participants} />}
          </div>
          
          {activeTab !== 'people' && (
            <div className="h-32 shrink-0 border-t border-white/5 bg-black/40 hidden sm:block">
              <VideoPanel participants={participants} localStream={localStream} remoteStreams={remoteStreams} compact isHost={isHost} />
            </div>
          )}
        </main>
      </div>

      <RoomControls 
        isLocked={isLocked} 
        setIsLocked={(l) => syncRoomState(roomId!, { is_locked: l })}
        onLeave={handleLeave}
        micActive={micActive}
        videoActive={videoActive}
        toggleMic={() => {setMicActive(!micActive); localStream?.getAudioTracks().forEach(t => t.enabled = !micActive)}}
        toggleVideo={() => {setVideoActive(!videoActive); localStream?.getVideoTracks().forEach(t => t.enabled = !videoActive)}}
        isHost={isHost}
      />
    </div>
  );
};

export default RoomPage;
