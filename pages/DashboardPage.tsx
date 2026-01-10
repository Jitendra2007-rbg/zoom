
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../types';
import { supabase } from '../services/supabase';

interface DashboardPageProps {
  user: User;
  logout: () => void;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ user, logout }) => {
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  const [roomSettings, setRoomSettings] = useState({
    title: '',
    maxMembers: 10,
    duration: 60,
    scheduledTime: ''
  });
  
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');

  const generateUniqueId = () => {
    return Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    const roomId = generateUniqueId();
    
    // Establish the room in the database
    const { error } = await supabase.from('rooms').insert({
      id: roomId,
      host_id: user.id,
      title: roomSettings.title || 'Untitled Session',
      participants: [{ ...user, role: 'host' }],
      is_locked: false,
      is_ended: false,
      shared_code: '',
      max_participants: roomSettings.maxMembers,
      duration_minutes: roomSettings.duration,
      scheduled_at: roomSettings.scheduledTime || null,
      created_at: new Date().toISOString()
    });

    if (error) {
      alert("Failed to create room: " + error.message);
      setIsCreating(false);
      return;
    }

    navigate(`/room/${roomId}?role=host`);
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');
    if (!joinCode.trim()) return;

    setIsJoining(true);
    // Validate if room exists and is active
    const { data, error } = await supabase
      .from('rooms')
      .select('id, is_ended, participants, max_participants')
      .eq('id', joinCode.toUpperCase().trim())
      .single();

    if (error || !data) {
      setJoinError('Room not found. Please check the code.');
      setIsJoining(false);
      return;
    }

    if (data.is_ended) {
      setJoinError('This session has already ended.');
      setIsJoining(false);
      return;
    }

    if (data.participants && data.participants.length >= (data.max_participants || 100)) {
      setJoinError('Room is full.');
      setIsJoining(false);
      return;
    }

    navigate(`/room/${data.id}?role=editor`);
    setIsJoining(false);
  };

  return (
    <div className="min-h-screen bg-[#050507] text-slate-200 overflow-x-hidden">
      <nav className="h-16 border-b border-white/5 flex items-center justify-between px-4 md:px-8 glass sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
            <i className="fas fa-terminal text-white text-sm md:text-base"></i>
          </div>
          <span className="font-extrabold text-lg md:text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">CODEX</span>
        </div>
        
        <div className="flex items-center gap-4 md:gap-6">
          <div className="flex items-center gap-3 pr-4 md:pr-6 border-r border-white/10">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-[10px] md:text-xs font-bold" style={{ backgroundColor: user.color }}>
              {user.name.charAt(0)}
            </div>
            <span className="font-semibold text-xs md:text-sm hidden sm:block">{user.name}</span>
          </div>
          <button onClick={logout} className="text-slate-500 hover:text-white transition-colors text-xs md:text-sm font-medium">
            Exit
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-20">
        <div className="text-center mb-10 md:mb-16 animate-fade-up">
          <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">Welcome back, {user.name.split(' ')[0]}</h1>
          <p className="text-slate-400 text-sm md:text-lg max-w-2xl mx-auto">Start a collaborative room or jump into a scheduled session.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 mb-20 animate-fade-up">
          <ActionCard 
            icon="fa-plus-circle"
            color="indigo"
            title="Create Room"
            desc="Host a workspace with full controls and duration settings."
            onClick={() => setShowCreateModal(true)}
          />
          <ActionCard 
            icon="fa-door-open"
            color="cyan"
            title="Join Room"
            desc="Connect to an ongoing session using a room code."
            onClick={() => setShowJoinModal(true)}
          />
          <ActionCard 
            icon="fa-laptop-code"
            color="emerald"
            title="Practice"
            desc="Private environment for solo coding and experimentation."
            onClick={() => navigate('/practice')}
          />
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <div className="bg-[#0e0e12] w-full max-w-md rounded-3xl border border-white/10 shadow-2xl p-6 md:p-8 animate-fade-up overflow-y-auto max-h-[90vh] custom-scrollbar">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl md:text-2xl font-bold">Workspace Configuration</h2>
                <button onClick={() => setShowCreateModal(false)} className="text-slate-500 hover:text-white p-2"><i className="fas fa-times"></i></button>
              </div>
              <form onSubmit={handleCreateRoom} className="space-y-4 md:space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Room Title</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Frontend Architecture Sync"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 focus:border-indigo-500 outline-none transition-all text-sm"
                    value={roomSettings.title}
                    onChange={e => setRoomSettings({...roomSettings, title: e.target.value})}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Duration (Min)</label>
                    <input 
                      type="number" 
                      min="5" 
                      max="480"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 focus:border-indigo-500 outline-none transition-all text-sm"
                      value={roomSettings.duration}
                      onChange={e => setRoomSettings({...roomSettings, duration: parseInt(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Max Members</label>
                    <input 
                      type="number" 
                      min="2" 
                      max="50"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 focus:border-indigo-500 outline-none transition-all text-sm"
                      value={roomSettings.maxMembers}
                      onChange={e => setRoomSettings({...roomSettings, maxMembers: parseInt(e.target.value)})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Schedule (Optional)</label>
                  <input 
                    type="datetime-local" 
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 focus:border-indigo-500 outline-none transition-all text-sm text-slate-300"
                    value={roomSettings.scheduledTime}
                    onChange={e => setRoomSettings({...roomSettings, scheduledTime: e.target.value})}
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={isCreating}
                  className="w-full btn-primary py-4 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] text-white transition-all transform hover:scale-[1.02] disabled:opacity-50"
                >
                  {isCreating ? 'Initializing Workspace...' : 'Launch Meeting'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Join Modal */}
        {showJoinModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <div className="bg-[#0e0e12] w-full max-w-sm rounded-3xl border border-white/10 shadow-2xl p-8 animate-fade-up">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl md:text-2xl font-bold">Enter Room Code</h2>
                <button onClick={() => setShowJoinModal(false)} className="text-slate-500 hover:text-white p-2"><i className="fas fa-times"></i></button>
              </div>
              <form onSubmit={handleJoinRoom} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Room ID</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="XXXX-XXXX"
                    className={`w-full bg-slate-900 border rounded-xl px-4 py-3 outline-none transition-all font-mono tracking-widest text-center text-lg uppercase ${joinError ? 'border-red-500' : 'border-slate-800 focus:border-cyan-500'}`}
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  />
                  {joinError && <p className="mt-2 text-red-500 text-[10px] font-bold uppercase text-center">{joinError}</p>}
                </div>
                <button 
                  type="submit" 
                  disabled={isJoining}
                  className="w-full bg-gradient-to-r from-cyan-600 to-cyan-500 py-4 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] text-white shadow-lg shadow-cyan-600/20 transition-all transform hover:scale-[1.02] disabled:opacity-50"
                >
                  {isJoining ? 'Validating...' : 'Join Session'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const ActionCard = ({ icon, color, title, desc, onClick }: { icon: string; color: string; title: string; desc: string; onClick: () => void }) => {
  const colorMap: any = {
    indigo: 'from-indigo-500 to-indigo-600 shadow-indigo-600/30',
    cyan: 'from-cyan-500 to-cyan-600 shadow-cyan-600/30',
    emerald: 'from-emerald-500 to-emerald-600 shadow-emerald-600/30'
  };

  return (
    <div 
      onClick={onClick}
      className="group bg-[#0e0e12] border border-white/5 rounded-3xl p-6 md:p-8 hover:border-white/20 transition-all cursor-pointer relative overflow-hidden active:scale-95 shadow-2xl flex flex-col justify-between h-full"
    >
      <div>
        <div className={`w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br ${colorMap[color]} flex items-center justify-center mb-4 md:mb-6 group-hover:scale-110 transition-transform duration-500`}>
          <i className={`fas ${icon} text-white text-xl md:text-3xl`}></i>
        </div>
        <h3 className="text-xl md:text-2xl font-bold text-white mb-2 md:mb-3">{title}</h3>
        <p className="text-slate-400 text-xs md:text-sm leading-relaxed mb-6 md:mb-8">{desc}</p>
      </div>
      
      <div className="flex items-center text-[10px] font-black text-white/40 group-hover:text-white transition-colors tracking-widest uppercase">
        Continue <i className="fas fa-arrow-right ml-2 group-hover:translate-x-1 transition-transform"></i>
      </div>
    </div>
  );
};

export default DashboardPage;
