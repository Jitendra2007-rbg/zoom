
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../types';

interface LandingPageProps {
  user: User | null;
  login: (name: string) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ user, login }) => {
  const [name, setName] = useState('');
  const navigate = useNavigate();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      login(name);
      navigate('/dashboard');
    }
  };

  if (user) {
    navigate('/dashboard');
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 px-4">
      <div className="max-w-4xl w-full text-center space-y-8 animate-in fade-in duration-1000">
        <div className="flex justify-center mb-4">
          <div className="bg-indigo-600 p-4 rounded-2xl shadow-2xl shadow-indigo-500/20">
            <i className="fas fa-code text-5xl text-white"></i>
          </div>
        </div>
        <h1 className="text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
          Codex Collab
        </h1>
        <p className="text-xl text-slate-300 max-w-2xl mx-auto">
          The integrated platform for collaborative coding, real-time learning, and peer-to-peer mentorship. 
          Built for teams, classrooms, and pair programmers.
        </p>

        <div className="mt-12 bg-white/5 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl max-w-md mx-auto">
          <h2 className="text-2xl font-bold mb-6">Join the Community</h2>
          <form onSubmit={handleJoin} className="space-y-4">
            <div className="text-left">
              <label className="block text-sm font-medium text-slate-400 mb-1 ml-1">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-indigo-600/30"
            >
              Start Coding <i className="fas fa-arrow-right ml-2"></i>
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
          <FeatureCard icon="fa-video" title="HD Video Calls" desc="Crystal clear audio/video with low latency screensharing." />
          <FeatureCard icon="fa-users" title="Live Sync IDE" desc="Monaco-powered editor with real-time cursor tracking." />
          <FeatureCard icon="fa-terminal" title="Sandboxed Run" desc="Execute code in multiple languages safely." />
        </div>
      </div>
    </div>
  );
};

const FeatureCard = ({ icon, title, desc }: { icon: string; title: string; desc: string }) => (
  <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 text-left">
    <i className={`fas ${icon} text-indigo-400 text-2xl mb-4`}></i>
    <h3 className="font-bold text-lg mb-2">{title}</h3>
    <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
  </div>
);

export default LandingPage;
