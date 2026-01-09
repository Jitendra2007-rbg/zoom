
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Language } from '../types';
import EditorPanel from '../components/EditorPanel';

interface PracticePageProps {
  user: User;
}

const PracticePage: React.FC<PracticePageProps> = ({ user }) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-screen bg-[#050507] overflow-hidden">
      <header className="h-14 border-b border-white/5 flex items-center justify-between px-6 glass shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
             <i className="fas fa-laptop-code text-white text-xs"></i>
          </div>
          <span className="font-black text-white text-sm uppercase tracking-tighter">Solo Practice <span className="text-emerald-500 ml-1">Sandbox</span></span>
        </div>

        <button 
          onClick={() => navigate('/dashboard')}
          className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
        >
          Exit Practice
        </button>
      </header>

      <main className="flex-1 min-h-0 relative">
        <EditorPanel 
          user={{...user, role: 'host'}} // In practice, you are the host of your own session
          isLocked={false}
          isPracticeMode={true}
        />
      </main>
      
      <footer className="h-10 border-t border-white/5 bg-black/40 flex items-center px-6 shrink-0">
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
          <i className="fas fa-info-circle mr-2"></i> Private environment. No data is synced or saved.
        </p>
      </footer>
    </div>
  );
};

export default PracticePage;
