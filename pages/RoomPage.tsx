
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
  const [hostId, setHostId] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [micActive, setMicActive] = useState(true);
  const [videoActive, setVideoActive] = useState(true);
  
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
  const localStreamRef = useRef<MediaStream | null>(null);

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

    return pc;
  }, [user.id]);

  useEffect(() => {
    if (!roomId) return;

    const setup = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        localStreamRef.current = stream;
      } catch (err) {
        console.error("Media failed", err);
      }

      const { data } = await supabase.from('rooms').select('*').eq('id', roomId).single();
      
      const realHostId = data?.host_id || (queryParams.get('role') === 'host' ? user.id : null);
      setHostId(realHostId);

      if (data?.is_ended) {
        setMeetingEnded(true);
        return;
      }

      let dbParticipants: User[] = data?.participants || [];
      const isAlreadyIn = dbParticipants.some(p => p.id === user.id);
      
      if (!isAlreadyIn) {
        const updatedUser: User = { ...user, role: realHostId === user.id ? 'host' : 'editor' };
        const updatedParts = [...dbParticipants, updatedUser];
        const payload: any = { participants: updatedParts };
        if (realHostId === user.id && !data) {
          payload.host_id = user.id;
          payload.title = queryParams.get('title') || 'Untitled Session';
          payload.start_time = Date.now();
          payload.is_ended = false;
        }
        await syncRoomState(roomId, payload);
        setParticipants(updatedParts);
      } else {
        setParticipants(dbParticipants);
      }
      
      if (data) {
        setIsLocked(data.is_locked);
        setSharedCode(data.shared_code || '');
      }
    };

    setup();

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

    const sigChannel = supabase.channel(`sig:${roomId}`);
    
    sigChannel
      .on('broadcast', { event: 'signal' }, async ({ payload }: { payload: SignalingMessage }) => {
        if (payload.to !== user.id) return;
        if (payload.type === 'offer') {
          const pc = createPeerConnection(payload.from, sigChannel);
          await pc.setRemoteDescription(new RTCSessionDescription(payload.payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sigChannel.send({ type: 'broadcast', event: 'signal', payload: { from: user.id, to: payload.from, type: 'answer', payload: answer } });
        } else if (payload.type === 'answer') {
          const pc = peerConnections.current[payload.from];
          if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload.payload));
        } else if (payload.type === 'candidate') {
          const pc = peerConnections.current[payload.from];
          if (pc) await pc.addIceCandidate(new RTCIceCandidate(payload.payload));
        }
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (hostId === payload.senderId && payload.senderId !== user.id) setSharedCode(payload.code);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setTimeout(async () => {
            const { data } = await supabase.from('rooms').select('participants').eq('id', roomId).single();
            const parts = data?.participants || [];
            for (const p of parts) {
              if (p.id !== user.id) {
                const pc = createPeerConnection(p.id, sigChannel);
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                sigChannel.send({ type: 'broadcast', event: 'signal', payload: { from: user.id, to: p.id, type: 'offer', payload: offer } });
              }
            }
          }, 2000);
        }
      });

    return () => {
      Object.values(peerConnections.current).forEach((pc: RTCPeerConnection) => pc.close());
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(sigChannel);
    };
  }, [roomId, user.id, createPeerConnection]);

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCopyLink = () => {
    const link = `${window.location.origin}${window.location.pathname}`;
    navigator.clipboard.writeText(`Join my Codex session!\nCode: ${roomId}\nLink: ${link}`);
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
      <div className="h-screen flex flex-col items-center justify-center bg-[#050507] text-white text-center p-4">
        <h1 className="text-4xl font-black mb-4 text-red-500 uppercase">Session Ended</h1>
        <button onClick={() => navigate('/dashboard')} className="px-10 py-4 bg-indigo-600 rounded-2xl font-bold">Dashboard</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#050507] overflow-hidden text-slate-200">
      <header className="h-14 border-b border-white/5 flex items-center justify-between px-4 glass shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center">
             <i className="fas fa-terminal text-white text-xs"></i>
          </div>
          <span className="font-black text-white text-sm uppercase">#{roomId}</span>
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
              <span className="hidden sm:inline">{copyFeedback ? 'Copied!' : 'Share'}</span>
            </button>
          )}

          <div className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-[10px] font-black uppercase text-slate-500">
            {isHost ? <span className="text-indigo-400">Host</span> : 'Participant'}
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
                onCodeChange={(code) => {
                  if (isHost) {
                    setSharedCode(code);
                    supabase.channel(`sig:${roomId}`).send({ type: 'broadcast', event: 'typing', payload: { code, senderId: user.id } });
                    syncRoomState(roomId!, { shared_code: code });
                  }
                }}
              />
            )}
            {activeTab === 'board' && <Whiteboard />}
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
            if (confirm("End for all?")) {
              await syncRoomState(roomId!, { is_ended: true });
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
