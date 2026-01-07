
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, User } from '../types';
import { supabase, sendChatMessage } from '../services/supabase';

interface ChatPanelProps {
  roomId: string;
  currentUser: User;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ roomId, currentUser }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch initial
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });
      if (data) setMessages(data);
    };

    fetchMessages();

    // Subscribe
    const channel = supabase
      .channel(`chat:${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` }, 
        (payload) => setMessages(prev => [...prev, payload.new as ChatMessage]))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      sendChatMessage(roomId, currentUser.id, currentUser.name, inputText);
      setInputText('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#08080a] min-h-0">
      <div className="h-10 flex items-center px-4 bg-black/20 border-b border-white/5 shrink-0">
        <span className="text-[9px] font-black text-slate-500 tracking-[0.3em] uppercase">Live Chat</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar min-h-0">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-700 opacity-30 text-center px-8">
            <i className="fas fa-comment-dots text-3xl mb-4"></i>
            <p className="text-[10px] font-bold uppercase tracking-widest">No messages yet. Start the conversation.</p>
          </div>
        )}
        
        {messages.map((msg) => {
          const isMe = msg.user_id === currentUser.id;
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-fade-up`}>
              <div className="flex items-center gap-2 mb-1 px-1">
                <span className={`text-[8px] font-black uppercase tracking-widest ${isMe ? 'text-indigo-400' : 'text-slate-500'}`}>
                  {msg.user_name}
                </span>
              </div>
              <div className={`px-3 py-2 rounded-xl text-xs max-w-[90%] break-words border shadow-xl ${isMe ? 'bg-indigo-600 border-indigo-500 text-white rounded-tr-none' : 'bg-[#121218] border-white/5 text-slate-300 rounded-tl-none'}`}>
                {msg.text}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-3 bg-black/40 border-t border-white/5 shrink-0 mb-14 sm:mb-0">
        <form onSubmit={handleSubmit} className="relative">
          <input 
            type="text" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Write a message..."
            className="w-full bg-[#0e0e12] border border-white/10 rounded-xl pl-4 pr-10 py-3 text-xs text-slate-300 focus:border-indigo-500 outline-none transition-all"
          />
          <button type="submit" disabled={!inputText.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 text-indigo-500 hover:text-indigo-400 disabled:opacity-20"><i className="fas fa-paper-plane text-xs"></i></button>
        </form>
      </div>
    </div>
  );
};

export default ChatPanel;
