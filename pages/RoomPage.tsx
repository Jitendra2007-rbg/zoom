
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
import { GoogleGenAI, Modality } from "@google/genai";

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
  const [startTime, setStartTime] = useState(Date.now());
  const [timeLeft, setTimeLeft] = useState(3600);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [micActive, setMicActive] = useState(true);
  const [videoActive, setVideoActive] = useState(true);
  
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
  const [currentRole, setCurrentRole] = useState<Role>('editor');
  const isHost = currentRole === 'host';

  const iceConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  };

  // 1. Initialize Room & Role
  useEffect(() => {
    if (!roomId) return;

    const setupRoom = async () => {
      const { data } = await supabase.from('rooms').select('*').eq('id', roomId).single();
      
      let dbParticipants: User[] = data?.participants || [];
      const realHostId = data?.host_id;
      
      // Strict Role Detection
      const myActualRole: Role = (realHostId === user.id || (!data && queryParams.get('role') === 'host')) ? 'host' : 'editor';
      setCurrentRole(myActualRole);

      if (data?.is_ended) {
        setMeetingEnded(true);
        return;
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
        }
        await syncRoomState(roomId, payload);
      }
      
      if (data) {
        setIsLocked(data.is_locked);
        setSharedCode(data.shared_code || '');
        setActiveLanguage(data.active_language as Language || Language.Javascript);
      }
    };

    setupRoom();

    // 2. Real-time Listeners
    const roomChannel = supabase
      .channel(`room:${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (payload) => {
        const updated = payload.new;
        if (updated.is_ended) setMeetingEnded(true);
        setIsLocked(updated.is_locked);
        setParticipants(updated.participants || []);
        if (updated.active_language) setActiveLanguage(updated.active_language);
        if (updated.shared_code !== undefined) setSharedCode(updated.shared_code);
      })
      .subscribe();

    // 3. WebRTC Signaling Channel
    const signalingChannel = supabase.channel(`signaling:${roomId}`);
    
    signalingChannel
      .on('broadcast', { event: 'signal' }, async ({ payload }: { payload: SignalingMessage }) => {
        if (payload.to !== user.id) return;

        if (payload.type === 'offer') {
          const pc = createPeerConnection(payload.from, signalingChannel);
          await pc.setRemoteDescription(new RTCSessionDescription(payload.payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          signalingChannel.send({
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

    // 4. Media Access
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
      setLocalStream(stream);
      // Trigger calls to existing participants
      participants.forEach(p => {
        if (p.id !== user.id) {
          const pc = createPeerConnection(p.id, signalingChannel);
          pc.createOffer().then(offer => {
            pc.setLocalDescription(offer);
            signalingChannel.send({
              type: 'broadcast',
              event: 'signal',
              payload: { from: user.id, to: p.id, type: 'offer', payload: offer }
            });
          });
        }
      });
    });

    return () => {
      Object.values(peerConnections.current).forEach(pc => pc.close());
      localStream?.getTracks().forEach(t => t.stop());
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(signalingChannel);
    };
  }, [roomId]);

  const createPeerConnection = (targetId: string, channel: any) => {
    if (peerConnections.current[targetId]) return peerConnections.current[targetId];

    const pc = new RTCPeerConnection(iceConfig);
    peerConnections.current[targetId] = pc;

    if (localStream) {
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
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

  const handleShare = () => {
    const url = `${window.location.origin}${window.location.pathname}#/room/${roomId}?role=editor`;
    navigator.clipboard.writeText(url);
    alert("Meeting link copied to clipboard!");
  };

  if (meetingEnded) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#050507] text-white p-6 text-center">
        <h1 className="text-4xl font-black mb-4 text-red-500 uppercase">Session Ended</h1>
        <p className="text-slate-400 mb-8">This meeting has been concluded by the host.</p>
        <button onClick={() => navigate('/dashboard')} className="px-10 py-4 bg-indigo-600 rounded-2xl font-bold uppercase tracking-widest hover:bg-indigo-500 shadow-2xl">Return Home</button>
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
          <span className="font-black text-white text-sm uppercase tracking-tighter">Codex Room <span className="text-indigo-500 ml-1">#{roomId}</span></span>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleShare} className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all">
            <i className="fas fa-share-alt"></i> Share Link
          </button>
          <div className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-[10px] font-black uppercase text-slate-500">
            {isHost ? 'Host' : 'Participant'}
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
                user={user} 
                isLocked={isLocked} 
                isPracticeMode={isPracticeMode}
                onLanguageChange={(l) => isHost && syncRoomState(roomId!, { active_language: l })}
                sharedCode={sharedCode}
                onCodeChange={handleCodeChange}
              />
            )}
            {activeTab === 'board' && <Whiteboard />}
            {activeTab === 'files' && <FilePanel roomId={roomId!} currentUser={user} />}
            {activeTab === 'notes' && <ChatPanel roomId={roomId!} currentUser={user} />}
          </div>
          
          {activeTab !== 'people' && (
            <div className="h-32 shrink-0 border-t border-white/5 bg-black/40 hidden sm:block">
              <VideoPanel participants={participants} localStream={localStream} remoteStreams={remoteStreams} compact isHost={isHost} />
            </div>
          )}

          {!isHost && activeTab === 'editor' && (
            <button 
              onClick={() => setIsPracticeMode(!isPracticeMode)}
              className={`fixed top-20 right-6 z-[60] px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all shadow-2xl ${isPracticeMode ? 'bg-amber-500 border-amber-400 text-white animate-pulse' : 'bg-indigo-600 border-indigo-500 text-white'}`}
            >
              <i className={`fas ${isPracticeMode ? 'fa-user-graduate' : 'fa-link-slash'} mr-2`}></i>
              {isPracticeMode ? 'Practice Mode Active' : 'Disconnect from Host'}
            </button>
          )}
        </main>
      </div>

      <RoomControls 
        isLocked={isLocked} 
        setIsLocked={(l) => syncRoomState(roomId!, { is_locked: l })}
        onLeave={() => isHost ? syncRoomState(roomId!, { is_ended: true }) : navigate('/dashboard')}
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
