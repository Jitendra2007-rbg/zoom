
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
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [sharedCode, setSharedCode] = useState('');
  const [meetingEnded, setMeetingEnded] = useState(false);
  const [timeLeft, setTimeLeft] = useState(3600);
  const [hostId, setHostId] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [micActive, setMicActive] = useState(true);
  const [videoActive, setVideoActive] = useState(true);
  
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const whiteboardSyncRef = useRef<any>(null);

  const isHost = hostId === user.id;

  const iceConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  const createPeerConnection = useCallback((targetId: string, channel: any) => {
    if (peerConnections.current[targetId]) return peerConnections.current[targetId];

    const pc = new RTCPeerConnection(iceConfig);
    peerConnections.current[targetId] = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
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
      console.log(`Received track from ${targetId}`, event.streams[0]);
      setRemoteStreams(prev => {
        const stream = event.streams[0];
        if (!stream) return prev;
        return { ...prev, [targetId]: stream };
      });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setRemoteStreams(prev => {
          const next = { ...prev };
          delete next[targetId];
          return next;
        });
      }
    };

    return pc;
  }, [user.id]);

  useEffect(() => {
    if (!roomId) return;

    const setup = async () => {
      // 1. Get local media
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 1280, height: 720 }, 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        setLocalStream(stream);
        localStreamRef.current = stream;
      } catch (err) {
        console.error("Media failed", err);
      }

      // 2. Room Validation
      const { data, error } = await supabase.from('rooms').select('*').eq('id', roomId).single();
      if (error || !data) {
        alert("Invalid Room ID. Returning to dashboard.");
        navigate('/dashboard');
        return;
      }

      setHostId(data.host_id);
      if (data.is_ended) {
        setMeetingEnded(true);
        return;
      }

      // 3. Register presence
      let dbParticipants: User[] = data.participants || [];
      const isAlreadyIn = dbParticipants.some(p => p.id === user.id);
      
      if (!isAlreadyIn) {
        const updatedUser: User = { ...user, role: data.host_id === user.id ? 'host' : 'editor' };
        const updatedParts = [...dbParticipants, updatedUser];
        await syncRoomState(roomId, { participants: updatedParts });
        setParticipants(updatedParts);
      } else {
        setParticipants(dbParticipants);
      }
      
      setIsLocked(data.is_locked);
      setSharedCode(data.shared_code || '');
      
      const duration = data.duration_minutes || 60;
      setTimeLeft(duration * 60);
    };

    setup();

    // Database Sync
    const roomChannel = supabase
      .channel(`room_db:${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (payload) => {
        const updated = payload.new;
        if (updated.is_ended) setMeetingEnded(true);
        setIsLocked(updated.is_locked);
        if (updated.participants) setParticipants(updated.participants);
        if (updated.shared_code !== undefined) setSharedCode(updated.shared_code);
        if (updated.host_id) setHostId(updated.host_id);
      })
      .subscribe();

    // Real-time Signaling
    const sigChannel = supabase.channel(`sig:${roomId}`);
    whiteboardSyncRef.current = sigChannel;
    
    sigChannel
      .on('broadcast', { event: 'signal' }, async ({ payload }: { payload: SignalingMessage }) => {
        if (payload.to !== user.id) return;
        
        const pc = createPeerConnection(payload.from, sigChannel);
        
        if (payload.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sigChannel.send({ type: 'broadcast', event: 'signal', payload: { from: user.id, to: payload.from, type: 'answer', payload: answer } });
        } else if (payload.type === 'answer') {
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.payload));
          }
        } else if (payload.type === 'candidate') {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.payload));
          } catch (e) {
            console.warn("ICE error", e);
          }
        }
      })
      .on('broadcast', { event: 'announce' }, async ({ payload }) => {
        // Only initiate if we are the one already in the room
        if (payload.userId !== user.id) {
          const pc = createPeerConnection(payload.userId, sigChannel);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sigChannel.send({ type: 'broadcast', event: 'signal', payload: { from: user.id, to: payload.userId, type: 'offer', payload: offer } });
        }
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (hostId === payload.senderId && payload.senderId !== user.id) {
          setSharedCode(payload.code);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Tell everyone I'm here
          sigChannel.send({ type: 'broadcast', event: 'announce', payload: { userId: user.id } });
        }
      });

    return () => {
      Object.values(peerConnections.current).forEach((pc: RTCPeerConnection) => pc.close());
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(sigChannel);
    };
  }, [roomId, user.id, createPeerConnection, hostId, navigate]);

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCopyLink = () => {
    const link = `${window.location.origin}/#/room/${roomId}`;
    navigator.clipboard.writeText(`Join Codex: ${link}\nCode: ${roomId}`);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (meetingEnded) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#050507] text-white">
        <h1 className="text-4xl font-black mb-4 text-red-500 uppercase">Session Ended</h1>
        <button onClick={() => navigate('/dashboard')} className="px-10 py-4 bg-indigo-600 rounded-2xl font-bold hover:bg-indigo-500 transition-all">Back to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#050507] overflow-hidden text-slate-200">
      <header className="h-14 border-b border-white/5 flex items-center justify-between px-4 glass shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
             <i className="fas fa-terminal text-white text-xs"></i>
          </div>
          <div className="flex flex-col">
            <span className="font-black text-white text-[10px] uppercase tracking-tighter">Codex Room</span>
            <span className="font-mono text-[9px] text-slate-500">#{roomId}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-[10px] font-mono font-black text-indigo-400">
            {formatTime(timeLeft)}
          </div>
          
          {isHost && (
            <button 
              onClick={handleCopyLink}
              className={`flex items-center gap-2 h-8 px-3 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest ${copyFeedback ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500 hover:text-white'}`}
            >
              <i className={`fas ${copyFeedback ? 'fa-check' : 'fa-share-nodes'}`}></i>
              <span className="hidden sm:inline">{copyFeedback ? 'Copied!' : 'Invite'}</span>
            </button>
          )}

          <div className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-[10px] font-black uppercase">
            {isHost ? <span className="text-indigo-400">Host</span> : <span className="text-slate-500">Editor</span>}
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          <div className="flex-1 min-h-0 overflow-hidden relative bg-[#0b0b0f]">
            {activeTab === 'people' && (
              <div className="h-full overflow-y-auto p-6">
                 <VideoPanel participants={participants} localStream={localStream} remoteStreams={remoteStreams} currentUser={user} hostId={hostId} />
              </div>
            )}
            {activeTab === 'editor' && (
              <EditorPanel 
                user={{...user, role: isHost ? 'host' : 'editor'}} 
                isLocked={isLocked} 
                sharedCode={sharedCode}
                isPracticeMode={isPracticeMode}
                onTogglePractice={() => setIsPracticeMode(!isPracticeMode)}
                onCodeChange={(code) => {
                  if (isHost) {
                    setSharedCode(code);
                    supabase.channel(`sig:${roomId}`).send({ type: 'broadcast', event: 'typing', payload: { code, senderId: user.id } });
                    syncRoomState(roomId!, { shared_code: code });
                  }
                }}
              />
            )}
            {activeTab === 'board' && (
              <Whiteboard 
                isHost={isHost} 
                roomId={roomId!} 
                sigChannel={whiteboardSyncRef.current} 
              />
            )}
            {activeTab === 'files' && <FilePanel roomId={roomId!} currentUser={{...user, role: isHost ? 'host' : 'editor'}} />}
            {activeTab === 'notes' && <ChatPanel roomId={roomId!} currentUser={{...user, role: isHost ? 'host' : 'editor'}} participants={participants} />}
          </div>
          
          {activeTab !== 'people' && (
            <div className="h-32 shrink-0 border-t border-white/5 bg-black/40 hidden sm:block">
              <VideoPanel participants={participants} localStream={localStream} remoteStreams={remoteStreams} currentUser={user} hostId={hostId} compact />
            </div>
          )}
        </main>
      </div>

      <RoomControls 
        isLocked={isLocked} 
        setIsLocked={(l) => syncRoomState(roomId!, { is_locked: l })}
        onLeave={async () => {
          if (isHost) {
            if (confirm("This will end the meeting for everyone. Continue?")) {
              await syncRoomState(roomId!, { is_ended: true });
              sessionStorage.removeItem(`codex_session_chat_${roomId}`);
              navigate('/dashboard');
            }
          } else {
            navigate('/dashboard');
          }
        }}
        micActive={micActive}
        videoActive={videoActive}
        toggleMic={() => { setMicActive(!micActive); localStream?.getAudioTracks().forEach(t => t.enabled = !micActive); }}
        toggleVideo={() => { setVideoActive(!videoActive); localStream?.getVideoTracks().forEach(t => t.enabled = !videoActive); }}
        isHost={isHost}
      />
    </div>
  );
};

export default RoomPage;
