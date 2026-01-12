
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
      { urls: 'stun:stun1.l.google.com:19302' }
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
      setRemoteStreams(prev => ({ ...prev, [targetId]: event.streams[0] }));
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setRemoteStreams(prev => {
          const next = { ...prev };
          delete next[targetId];
          return next;
        });
        if (peerConnections.current[targetId]) {
          peerConnections.current[targetId].close();
          delete peerConnections.current[targetId];
        }
      }
    };

    return pc;
  }, [user.id]);

  useEffect(() => {
    if (!roomId) return;

    const setupRoom = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        localStreamRef.current = stream;
      } catch (err) {
        console.error("Media permission denied", err);
      }

      const { data, error } = await supabase.from('rooms').select('*').eq('id', roomId).maybeSingle();
      if (error || !data) {
        alert("Room not found");
        navigate('/dashboard');
        return;
      }

      setHostId(data.host_id);
      setIsLocked(data.is_locked);
      setSharedCode(data.shared_code || '');
      setTimeLeft((data.duration_minutes || 60) * 60);

      const currentParticipants: User[] = data.participants || [];
      const amIAlreadyIn = currentParticipants.some(p => p.id === user.id);
      
      if (!amIAlreadyIn) {
        const myUser: User = { 
          ...user, 
          role: data.host_id === user.id ? 'host' : 'editor' 
        };
        const updatedParticipants = [...currentParticipants, myUser];
        setParticipants(updatedParticipants);
        await syncRoomState(roomId, { participants: updatedParticipants });
      } else {
        setParticipants(currentParticipants);
      }
    };

    setupRoom();

    const roomDbChannel = supabase
      .channel(`room_state_${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (payload) => {
        const updated = payload.new;
        if (updated.is_ended) setMeetingEnded(true);
        setIsLocked(updated.is_locked);
        if (updated.participants) setParticipants(updated.participants);
        if (updated.host_id) setHostId(updated.host_id);
        if (updated.host_id !== user.id && updated.shared_code !== undefined) {
          setSharedCode(updated.shared_code);
        }
      })
      .subscribe();

    const sigChannel = supabase.channel(`sig_${roomId}`);
    whiteboardSyncRef.current = sigChannel;
    
    sigChannel
      .on('broadcast', { event: 'signal' }, async ({ payload }) => {
        if (payload.to !== user.id) return;
        const pc = createPeerConnection(payload.from, sigChannel);
        if (payload.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sigChannel.send({ type: 'broadcast', event: 'signal', payload: { from: user.id, to: payload.from, type: 'answer', payload: answer } });
        } else if (payload.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.payload));
        } else if (payload.type === 'candidate') {
          await pc.addIceCandidate(new RTCIceCandidate(payload.payload));
        }
      })
      .on('broadcast', { event: 'announce' }, async ({ payload }) => {
        if (payload.userId !== user.id) {
          const pc = createPeerConnection(payload.userId, sigChannel);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sigChannel.send({ type: 'broadcast', event: 'signal', payload: { from: user.id, to: payload.userId, type: 'offer', payload: offer } });
        }
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.senderId !== user.id) {
          setSharedCode(payload.code);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          sigChannel.send({ type: 'broadcast', event: 'announce', payload: { userId: user.id } });
        }
      });

    return () => {
      // Fix: Explicitly cast to RTCPeerConnection[] to ensure correct typing for Object.values.
      (Object.values(peerConnections.current) as RTCPeerConnection[]).forEach(pc => pc.close());
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      supabase.removeChannel(roomDbChannel);
      supabase.removeChannel(sigChannel);
    };
  }, [roomId, user.id, createPeerConnection, navigate]);

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCopyLink = () => {
    const link = `${window.location.origin}/#/room/${roomId}`;
    navigator.clipboard.writeText(`Join Session: ${link}`);
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
      <div className="h-screen flex flex-col items-center justify-center bg-[#050507] text-white p-8 text-center">
        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
          <i className="fas fa-power-off text-3xl text-red-500"></i>
        </div>
        <h1 className="text-4xl font-black mb-4 uppercase tracking-tighter">Session Concluded</h1>
        <p className="text-slate-400 mb-8 max-w-md">The host has ended this collaborative workspace.</p>
        <button onClick={() => navigate('/dashboard')} className="px-10 py-4 bg-indigo-600 rounded-2xl font-bold hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20">Return to Dashboard</button>
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
            <span className="font-black text-white text-[10px] uppercase tracking-tighter">Codex Sync</span>
            <span className="font-mono text-[9px] text-slate-500">#{roomId}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-[10px] font-mono font-black text-indigo-400">
            {formatTime(timeLeft)}
          </div>
          
          <button 
            onClick={handleCopyLink}
            className={`flex items-center gap-2 h-8 px-3 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest ${copyFeedback ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500 hover:text-white'}`}
          >
            <i className={`fas ${copyFeedback ? 'fa-check' : 'fa-share-nodes'}`}></i>
            <span className="hidden sm:inline">{copyFeedback ? 'Copied!' : 'Invite'}</span>
          </button>

          <div className={`px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-[10px] font-black uppercase flex items-center gap-2`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isHost ? 'bg-amber-400' : 'bg-slate-500'}`}></div>
            {isHost ? <span className="text-amber-400">Host</span> : <span className="text-slate-500">Editor</span>}
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="flex-1 flex flex-col min-w-0 relative">
          <div className="flex-1 min-h-0 relative bg-[#0b0b0f] overflow-hidden">
            {activeTab === 'people' && (
              <div className="h-full overflow-y-auto p-4 md:p-6 custom-scrollbar">
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
                  if (isHost || !isLocked) {
                    setSharedCode(code);
                    supabase.channel(`sig_${roomId}`).send({ 
                      type: 'broadcast', 
                      event: 'typing', 
                      payload: { code, senderId: user.id } 
                    });
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
            <div className="h-28 md:h-32 shrink-0 border-t border-white/5 bg-black/40 overflow-x-auto overflow-y-hidden custom-scrollbar">
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
            if (confirm("End this session for everyone?")) {
              await syncRoomState(roomId!, { is_ended: true });
              navigate('/dashboard');
            }
          } else {
            const updated = participants.filter(p => p.id !== user.id);
            await syncRoomState(roomId!, { participants: updated });
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
