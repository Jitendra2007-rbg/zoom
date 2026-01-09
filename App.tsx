
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { User } from './types';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import RoomPage from './pages/RoomPage';
import PracticePage from './pages/PracticePage';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('codex_user');
    return saved ? JSON.parse(saved) : null;
  });

  const login = (name: string) => {
    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      role: 'editor',
      color: '#' + Math.floor(Math.random()*16777215).toString(16)
    };
    setUser(newUser);
    localStorage.setItem('codex_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('codex_user');
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage user={user} login={login} />} />
        <Route path="/dashboard" element={user ? <DashboardPage user={user} logout={logout} /> : <LandingPage user={user} login={login} />} />
        <Route path="/room/:roomId" element={user ? <RoomPage user={user} /> : <LandingPage user={user} login={login} />} />
        <Route path="/practice" element={user ? <PracticePage user={user} /> : <LandingPage user={user} login={login} />} />
      </Routes>
    </Router>
  );
};

export default App;
