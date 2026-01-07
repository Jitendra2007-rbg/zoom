
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { User, Role, ChatMessage, Language } from '../types';
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
  
  const initialRole = (queryParams.get('role') as Role) || 'editor';
  const initialDuration = parseInt(queryParams.get('duration') || '60');

  // UI State
  const [activeTab, setActiveTab] = useState<TabType>('editor');
  const [participants, setParticipants] = useState<User[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [activeLanguage, setActiveLanguage] = useState<Language>(Language.Javascript);
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [sharedCode, setSharedCode] = useState('');
  const [copying, setCopying] = useState(false);

  // Timing
  const [durationMinutes, setDurationMinutes] = useState(initialDuration);
  const [startTime, setStartTime] = useState(Date.now());
  const [timeLeft, setTimeLeft] = useState(initialDuration * 60);

  // Transcription
  const [transcription, setTranscription] = useState('');

  // Media
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [micActive, setMicActive] = useState(true);
  const [videoActive, setVideoActive] = useState(true);

  const isHost = user.role === 'host' || initialRole === 'host';

  useEffect(() => {
    if (!roomId) return;

    const setupRoom = async () => {
      const { data, error } = await supabase.from('rooms').select('*').eq('id', roomId).single();
      
      let currentParticipants: User[] = data?.participants || [];
      
      if (data) {
        if (data.is_ended) { 
          navigate('/dashboard'); 
          return; 
        }
        setIsLocked(data.is_locked);
        if (data.start_time) setStartTime(data.start_time);
        if (data.active_language) setActiveLanguage(data.active_language as Language);
        if (data.shared_code) setSharedCode(data.shared_code);
      }

      // Instant Joining Logic
      const isAlreadyIn = currentParticipants.some(p => p.id === user.id);
      if (!isAlreadyIn) {
        const newUser: User = { ...user, role: isHost ? 'host' : 'editor' };
        const updatedParticipants = [...currentParticipants, newUser];
        
        // Optimistic UI update
        setParticipants(updatedParticipants);

        const updatePayload: any = { participants: updatedParticipants };
        if (isHost && !data) {
          updatePayload.title = queryParams.get('title') || 'Untitled Session';
          updatePayload.host_id = user.id;
          updatePayload.start_time = Date.now();
          updatePayload.duration_minutes = initialDuration;
          updatePayload.is_ended = false;
        }
        
        await syncRoomState(roomId, updatePayload);
      } else {
        setParticipants(currentParticipants);
      }
    };

    setupRoom();

    const channel = supabase
      .channel(`room_sync:${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (payload) => {
        const updated = payload.new;
        if (updated.is_ended) {
          navigate('/dashboard');
        } else {
          setIsLocked(updated.is_locked);
          setParticipants(updated.participants || []);
          if (updated.shared_code !== undefined) setSharedCode(updated.shared_code);
        }
      })
      .subscribe();

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        setLocalStream(stream);
        stream.getAudioTracks().forEach(t => t.enabled = micActive);
        stream.getVideoTracks().forEach(t => t.enabled = videoActive);
      })
      .catch(err => console.error("Media permission denied", err));

    return () => {
      localStream?.getTracks().forEach(t => t.stop());
      supabase.removeChannel(channel);
    };
  }, [roomId, navigate]);

  // Timer
  useEffect(() => {
    if (initialDuration === 0) return;
    const interval = setInterval(() => {
      const remaining = (durationMinutes * 60) - Math.floor((Date.now() - startTime) / 1000);
      const safeRemaining = remaining < 0 ? 0 : remaining;
      setTimeLeft(safeRemaining);
      if (remaining <= 0) { 
        clearInterval(interval); 
        handleLeave(); 
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, durationMinutes, initialDuration]);

  const handleLeave = useCallback(async () => {
    if (isHost) { 
      if (confirm("End meeting for all participants?")) {
        await syncRoomState(roomId!, { is_ended: true }); 
      }
    } else {
      const updated = participants.filter(p => p.id !== user.id);
      await syncRoomState(roomId!, { participants: updated });
    }
    navigate('/dashboard');
  }, [isHost, roomId, participants, user.id, navigate]);

  const handleCodeChange = (code: string) => {
    if (isHost) { syncRoomState(roomId!, { shared_code: code }); }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  };

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
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest truncate max-w-[80px] sm:max-w-none bg-white/5 px-2 py-1 rounded border border-white/5">
            ID: {roomId}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleShare}
            title="Copy Meeting Link"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl ${copying ? 'bg-emerald-500 text-white' : 'bg-white/5 text-slate-400 hover:text-white border border-white/10 hover:bg-white/10'}`}
          >
            <i className={`fas ${copying ? 'fa-check-circle' : 'fa-share-nodes'}`}></i>
            <span className="hidden sm:inline">{copying ? 'Copied Link' : 'Share'}</span>
          </button>

          {timeLeft > 0 && (
            <div className={`flex items-center gap-3 px-3 py-1.5 rounded-full border transition-all ${timeLeft < 300 ? 'bg-red-500/10 border-red-500/30 text-red-500 animate-pulse' : 'bg-white/5 border-white/10 text-slate-400'}`}>
              <i className="fas fa-clock text-[9px]"></i>
              <span className="font-mono text-xs font-bold">{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</span>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative min-h-0">
          <div className="flex-1 min-h-0 overflow-hidden relative bg-[#0b0b0f]">
            {activeTab === 'people' && (
              <div className="h-full overflow-y-auto custom-scrollbar p-6">
                 <VideoPanel participants={participants} localStream={localStream} isHost={isHost} onMute={() => {}} onRemove={() => {}} />
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
              className={`fixed top-20 right-6 z-[60] px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-2xl border ${isPracticeMode ? 'bg-amber-500 border-amber-400 text-white animate-pulse' : 'bg-indigo-600 border-indigo-500 text-white'}`}
            >
              <i className={`fas ${isPracticeMode ? 'fa-user-graduate' : 'fa-laptop-code'} mr-2`}></i>
              {isPracticeMode ? 'Practice Active' : 'Switch to Practice'}
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
