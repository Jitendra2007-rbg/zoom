
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { User, Role, Language } from '../types';
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
  
  const requestedRole = (queryParams.get('role') as Role) || 'editor';
  const initialDuration = parseInt(queryParams.get('duration') || '60');

  const [activeTab, setActiveTab] = useState<TabType>('editor');
  const [participants, setParticipants] = useState<User[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [activeLanguage, setActiveLanguage] = useState<Language>(Language.Javascript);
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [sharedCode, setSharedCode] = useState('');
  const [copying, setCopying] = useState(false);
  const [meetingEnded, setMeetingEnded] = useState(false);

  const [startTime, setStartTime] = useState(Date.now());
  const [timeLeft, setTimeLeft] = useState(initialDuration * 60);

  const [transcription, setTranscription] = useState('');
  const transcriptionTimeoutRef = useRef<number | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [micActive, setMicActive] = useState(true);
  const [videoActive, setVideoActive] = useState(true);

  // Use local state to track our actual role in this room
  const [currentRole, setCurrentRole] = useState<Role>(requestedRole);
  const isHost = currentRole === 'host';

  useEffect(() => {
    if (!roomId) return;

    const setupRoom = async () => {
      const { data } = await supabase.from('rooms').select('*').eq('id', roomId).single();
      
      let existingParticipants: User[] = data?.participants || [];
      
      if (data) {
        if (data.is_ended) {
          setMeetingEnded(true);
          return;
        }
        setIsLocked(data.is_locked);
        if (data.start_time) setStartTime(data.start_time);
        if (data.active_language) setActiveLanguage(data.active_language as Language);
        if (data.shared_code) setSharedCode(data.shared_code);
        
        // Check if user is the real host stored in DB
        if (data.host_id === user.id) {
          setCurrentRole('host');
        } else {
          setCurrentRole('editor');
        }
      }

      const isAlreadyIn = existingParticipants.some(p => p.id === user.id);
      if (!isAlreadyIn) {
        const myRoleInRoom: Role = (isHost || (data?.host_id === user.id) || (!data && requestedRole === 'host')) ? 'host' : 'editor';
        const updatedUser: User = { ...user, role: myRoleInRoom };
        const updatedParticipants = [...existingParticipants, updatedUser];
        
        setParticipants(updatedParticipants);

        const updatePayload: any = { participants: updatedParticipants };
        if (myRoleInRoom === 'host' && !data) {
          updatePayload.title = queryParams.get('title') || 'Untitled Session';
          updatePayload.host_id = user.id;
          updatePayload.start_time = Date.now();
          updatePayload.duration_minutes = initialDuration;
          updatePayload.is_ended = false;
        }
        await syncRoomState(roomId, updatePayload);
      } else {
        setParticipants(existingParticipants);
      }
    };

    setupRoom();

    const channel = supabase
      .channel(`room_sync:${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (payload) => {
        const updated = payload.new;
        if (updated.is_ended) {
          setMeetingEnded(true);
        } else {
          setIsLocked(updated.is_locked);
          setParticipants(updated.participants || []);
          if (updated.shared_code !== undefined) {
            setSharedCode(updated.shared_code);
          }
        }
      })
      .subscribe();

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        setLocalStream(stream);
        // Start transcription logic
        initTranscription(stream);
      })
      .catch(err => console.error("Media error", err));

    return () => {
      localStream?.getTracks().forEach(t => t.stop());
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const initTranscription = async (stream: MediaStream) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onmessage: (message: any) => {
            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              setTranscription(text);
              if (transcriptionTimeoutRef.current) window.clearTimeout(transcriptionTimeoutRef.current);
              transcriptionTimeoutRef.current = window.setTimeout(() => setTranscription(''), 5000);
            }
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
        }
      });

      sessionPromise.then(session => {
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcm = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            pcm[i] = inputData[i] * 32768;
          }
          const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm.buffer)));
          session.sendRealtimeInput({ media: { data: base64, mimeType: 'audio/pcm;rate=16000' } });
        };
        source.connect(processor);
        processor.connect(audioContext.destination);
      });
    } catch (e) {
      console.error("Transcription failed to start", e);
    }
  };

  useEffect(() => {
    if (initialDuration === 0) return;
    const interval = setInterval(() => {
      const remaining = (initialDuration * 60) - Math.floor((Date.now() - startTime) / 1000);
      setTimeLeft(remaining < 0 ? 0 : remaining);
      if (remaining <= 0) {
        handleLeave();
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const handleLeave = useCallback(async () => {
    if (isHost) {
      if (confirm("End meeting for everyone?")) {
        await syncRoomState(roomId!, { is_ended: true });
      }
    } else {
      const updated = participants.filter(p => p.id !== user.id);
      await syncRoomState(roomId!, { participants: updated });
    }
    navigate('/dashboard');
  }, [isHost, roomId, participants, user.id]);

  const handleCodeChange = (code: string) => {
    if (isHost) {
      syncRoomState(roomId!, { shared_code: code });
    }
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}${window.location.hash}`;
    navigator.clipboard.writeText(shareUrl);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  };

  if (meetingEnded) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#050507] text-white p-6 text-center">
        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
          <i className="fas fa-calendar-times text-4xl text-red-500"></i>
        </div>
        <h1 className="text-3xl font-bold mb-2">Meeting Ended</h1>
        <p className="text-slate-400 mb-8 max-w-sm">This session has been closed by the host or the scheduled time has expired.</p>
        <button onClick={() => navigate('/dashboard')} className="px-8 py-3 bg-indigo-600 rounded-xl font-bold hover:bg-indigo-500 transition-all">
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#050507] overflow-hidden text-slate-200" style={{ height: 'calc(var(--vh, 1vh) * 100)' }}>
      <header className="h-14 border-b border-white/5 flex items-center justify-between px-4 glass shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-600 rounded-lg flex items-center justify-center">
              <i className="fas fa-terminal text-[10px] text-white"></i>
            </div>
            <span className="font-black text-indigo-400 text-lg uppercase tracking-tighter">Codex</span>
          </div>
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest bg-white/5 px-2 py-1 rounded border border-white/5">
            ID: {roomId}
          </span>
        </div>

        {transcription && (
          <div className="absolute left-1/2 -translate-x-1/2 max-w-[40%] bg-indigo-500/10 border border-indigo-500/30 px-4 py-1.5 rounded-2xl text-[10px] text-indigo-400 font-bold italic truncate shadow-2xl animate-pulse">
            <i className="fas fa-microphone mr-2"></i> "{transcription}"
          </div>
        )}

        <div className="flex items-center gap-3">
          <button onClick={handleShare} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${copying ? 'bg-emerald-500 text-white' : 'bg-white/5 text-slate-400 border border-white/10'}`}>
            <i className={`fas ${copying ? 'fa-check-circle' : 'fa-share-nodes'}`}></i>
            <span className="hidden sm:inline">{copying ? 'Copied' : 'Share'}</span>
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-slate-400">
            <span className="font-mono text-xs font-bold">{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative min-h-0">
          <div className="flex-1 min-h-0 overflow-hidden relative bg-[#0b0b0f]">
            {activeTab === 'people' && (
              <div className="h-full overflow-y-auto custom-scrollbar p-6">
                 <VideoPanel participants={participants} localStream={localStream} isHost={isHost} />
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
            <div className="h-28 md:h-36 shrink-0 border-t border-white/5 bg-black/40 overflow-hidden hidden sm:block">
              <VideoPanel participants={participants} localStream={localStream} compact isHost={isHost} />
            </div>
          )}

          {!isHost && activeTab === 'editor' && (
            <button 
              onClick={() => setIsPracticeMode(!isPracticeMode)}
              className={`fixed top-20 right-6 z-[60] px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border ${isPracticeMode ? 'bg-amber-500 border-amber-400 text-white animate-pulse' : 'bg-indigo-600 border-indigo-500 text-white'}`}
            >
              {isPracticeMode ? 'Practice Mode: ON' : 'Switch to Practice'}
            </button>
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
