
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
  const [roomSettings, setRoomSettings] = useState({
    title: '',
    maxMembers: 10,
    type: 'Team',
    initialLock: false,
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
    const roomId = generateUniqueId();
    
    // Create the room entry in Supabase first to establish host_id
    const { error } = await supabase.from('rooms').insert({
      id: roomId,
      host_id: user.id,
      title: roomSettings.title || 'Untitled Session',
      participants: [{ ...user, role: 'host' }],
      is_locked: false,
      is_ended: false,
      shared_code: '',
      created_at: new Date().toISOString()
    });

    if (error) {
      alert("Failed to create room: " + error.message);
      return;
    }

    const scheduleParam = roomSettings.scheduledTime ? `&scheduled=${new Date(roomSettings.scheduledTime).getTime()}` : '';
    navigate(`/room/${roomId}?role=host&duration=${roomSettings.duration}${scheduleParam}`);
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');
    if (!joinCode.trim()) return;

    setIsJoining(true);
    // Validate if room exists
    const { data, error } = await supabase
      .from('rooms')
      .select('id, is_ended')
      .eq('id', joinCode.toUpperCase())
      .single();

    if (error || !data) {
      setJoinError('Invalid Room ID. Please check the code and try again.');
      setIsJoining(false);
      return;
    }

    if (data.is_ended) {
      setJoinError('This session has already ended.');
      setIsJoining(false);
      return;
    }

    navigate(`/room/${joinCode.toUpperCase()}?role=editor`);
    setIsJoining(false);
  };

  const startSoloPractice = () => {
    navigate('/practice');
  };

  return (
    <div className="min-h-screen bg-[#050507] text-slate-200 overflow-x-hidden">
      <nav className="h-16 border-b border-white/5 flex items-center justify-between px-4 md:px-8 glass sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <i className="fas fa-terminal text-white text-sm md:text-base"></i>
          </div>
          <span className="font-extrabold text-lg md:text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">CODEX</span>
        </div>
        
        <div className="flex items-center gap-4 md:gap-6">
          <div className="flex items-center gap-3 pr-4 md:pr-6 border-r border-white/10 max-w-[120px] md:max-w-none">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-full border-2 border-indigo-500/50 flex items-center justify-center text-[10px] md:text-xs font-bold shrink-0" style={{ backgroundColor: user.color }}>
              {user.name.charAt(0)}
            </div>
            <span className="font-semibold text-xs md:text-sm truncate hidden sm:block">{user.name}</span>
          </div>
          <button onClick={logout} className="text-slate-500 hover:text-white transition-colors text-xs md:text-sm font-medium">
            Exit
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-20">
        <div className="text-center mb-10 md:mb-16 animate-fade-up">
          <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4">Hello, {user.name.split(' ')[0]}</h1>
          <p className="text-slate-400 text-sm md:text-lg max-w-2xl mx-auto">Start a collaborative project or sharpen your skills in a private sandbox.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 mb-20 animate-fade-up">
          <ActionCard 
            icon="fa-plus-circle"
            color="indigo"
            title="Create"
            desc="Host a workspace with full controls and timing."
            onClick={() => setShowCreateModal(true)}
          />
          <ActionCard 
            icon="fa-door-open"
            color="cyan"
            title="Join"
            desc="Connect to an ongoing team session."
            onClick={() => setShowJoinModal(true)}
          />
          <ActionCard 
            icon="fa-laptop-code"
            color="emerald"
            title="Practice"
            desc="Private environment for solo coding."
            onClick={startSoloPractice}
          />
        </div>

        {showCreateModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <div className="bg-[#0e0e12] w-full max-w-md rounded-3xl border border-white/10 shadow-2xl p-6 md:p-8 animate-fade-up overflow-y-auto max-h-[90vh] custom-scrollbar">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl md:text-2xl font-bold">New Workspace</h2>
                <button onClick={() => setShowCreateModal(false)} className="text-slate-500 hover:text-white p-2"><i className="fas fa-times"></i></button>
              </div>
              <form onSubmit={handleCreateRoom} className="space-y-4 md:space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Project Title</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. System Design Interview"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 focus:border-indigo-500 outline-none transition-all text-sm"
                    value={roomSettings.title}
                    onChange={e => setRoomSettings({...roomSettings, title: e.target.value})}
                  />
                </div>
                <button type="submit" className="w-full btn-primary py-3 md:py-4 rounded-xl font-bold text-white transition-all transform hover:scale-[1.02] text-sm md:text-base">
                  Create Workspace
                </button>
              </form>
            </div>
          </div>
        )}

        {showJoinModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <div className="bg-[#0e0e12] w-full max-w-sm rounded-3xl border border-white/10 shadow-2xl p-8 animate-fade-up">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl md:text-2xl font-bold">Enter Code</h2>
                <button onClick={() => setShowJoinModal(false)} className="text-slate-500 hover:text-white p-2"><i className="fas fa-times"></i></button>
              </div>
              <form onSubmit={handleJoinRoom} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Invitation ID</label>
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
                  className="w-full bg-gradient-to-r from-cyan-600 to-cyan-500 py-3 md:py-4 rounded-xl font-bold text-white shadow-lg shadow-cyan-600/20 transition-all transform hover:scale-[1.02] text-sm md:text-base disabled:opacity-50"
                >
                  {isJoining ? 'Verifying...' : 'Join Meeting'}
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
      className="group bg-[#0e0e12] border border-white/5 rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 hover:border-white/20 transition-all cursor-pointer relative overflow-hidden active:scale-95 shadow-2xl flex flex-col justify-between"
    >
      <div>
        <div className={`w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-[1.25rem] bg-gradient-to-br ${colorMap[color]} flex items-center justify-center mb-4 md:mb-6 group-hover:scale-110 transition-transform duration-500 shadow-lg`}>
          <i className={`fas ${icon} text-white text-xl md:text-3xl`}></i>
        </div>
        <h3 className="text-xl md:text-2xl font-bold text-white mb-2 md:mb-3 group-hover:text-indigo-400 transition-colors">{title}</h3>
        <p className="text-slate-400 text-xs md:text-sm leading-relaxed mb-6 md:mb-8">{desc}</p>
      </div>
      
      <div className="flex items-center text-[10px] md:text-xs font-bold text-white/40 group-hover:text-white transition-colors tracking-widest uppercase">
        Launch <i className="fas fa-arrow-right ml-2 group-hover:translate-x-1 transition-transform"></i>
      </div>
    </div>
  );
};

export default DashboardPage;
