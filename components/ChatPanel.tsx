
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, User } from '../types';
import { supabase, sendChatMessage } from '../services/supabase';

interface ChatPanelProps {
  roomId: string;
  currentUser: User;
  participants: User[];
}

interface InternalMessage extends ChatMessage {
  recipient_id?: string;
  is_private?: boolean;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ roomId, currentUser, participants }) => {
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [recipient, setRecipient] = useState<string>('everyone');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });
      if (data) setMessages(data);
    };

    fetchMessages();

    const dbChannel = supabase
      .channel(`chat:${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` }, 
        (payload) => setMessages(prev => [...prev, payload.new as ChatMessage]))
      .subscribe();

    const broadcastChannel = supabase.channel(`private_chat:${roomId}`);
    broadcastChannel
      .on('broadcast', { event: 'private_msg' }, ({ payload }) => {
        if (payload.recipient_id === currentUser.id || payload.user_id === currentUser.id) {
          setMessages(prev => [...prev, { ...payload, is_private: true }]);
        }
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(dbChannel); 
      supabase.removeChannel(broadcastChannel);
    };
  }, [roomId, currentUser.id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    if (recipient === 'everyone') {
      sendChatMessage(roomId, currentUser.id, currentUser.name, inputText);
    } else {
      const privateMsg = {
        id: Math.random().toString(36).substr(2, 9),
        user_id: currentUser.id,
        user_name: currentUser.name,
        text: inputText,
        recipient_id: recipient,
        created_at: new Date().toISOString()
      };
      
      supabase.channel(`private_chat:${roomId}`).send({
        type: 'broadcast',
        event: 'private_msg',
        payload: privateMsg
      });

      setMessages(prev => [...prev, { ...privateMsg, is_private: true }]);
    }
    
    setInputText('');
  };

  const recipientUser = participants.find(p => p.id === recipient);

  return (
    <div className="flex h-full bg-[#08080a] min-h-0 overflow-hidden">
      {/* Participants List */}
      <div className="w-1/3 sm:w-1/4 border-r border-white/5 flex flex-col shrink-0">
        <div className="h-10 flex items-center px-4 bg-black/20 border-b border-white/5 shrink-0">
          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Chat List</span>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          <button 
            onClick={() => setRecipient('everyone')}
            className={`w-full flex items-center gap-2 p-2 rounded-xl transition-all ${recipient === 'everyone' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-white/5 text-slate-400'}`}
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-xs">
              <i className="fas fa-users"></i>
            </div>
            <div className="hidden sm:block text-left min-w-0">
              <p className="text-[10px] font-bold truncate">Everyone</p>
            </div>
          </button>
          
          <div className="h-[1px] bg-white/5 my-2"></div>
          
          {participants.filter(p => p.id !== currentUser.id).map(p => (
            <button 
              key={p.id}
              onClick={() => setRecipient(p.id)}
              className={`w-full flex items-center gap-2 p-2 rounded-xl transition-all group ${recipient === p.id ? 'bg-amber-500 text-white shadow-lg' : 'hover:bg-white/5 text-slate-400'}`}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 shadow-md" style={{ backgroundColor: p.color }}>
                {p.name.charAt(0)}
              </div>
              <div className="hidden sm:flex flex-1 items-center justify-between min-w-0">
                <p className="text-[10px] font-bold truncate">{p.name}</p>
                <i className={`fas fa-comment-dots text-[10px] opacity-40 group-hover:opacity-100 transition-opacity`}></i>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-10 flex items-center justify-between px-4 bg-black/20 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[8px] text-slate-600 font-bold uppercase">Chatting with:</span>
            <span className={`text-[9px] font-black uppercase tracking-widest ${recipient === 'everyone' ? 'text-indigo-400' : 'text-amber-500'}`}>
              {recipient === 'everyone' ? 'Everyone' : recipientUser?.name}
            </span>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {messages.map((msg, idx) => {
            const isMe = msg.user_id === currentUser.id;
            const isPrivate = msg.is_private || !!msg.recipient_id;
            
            // Logic to show public messages or private messages involving me
            if (isPrivate && msg.user_id !== currentUser.id && msg.recipient_id !== currentUser.id) return null;
            
            return (
              <div key={msg.id || idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-fade-up`}>
                <div className="flex items-center gap-2 mb-1 px-1">
                  <span className={`text-[8px] font-black uppercase tracking-widest ${isMe ? 'text-indigo-400' : 'text-slate-500'}`}>
                    {msg.user_name} {isPrivate && <span className="text-amber-500 ml-1 font-black">[Private]</span>}
                  </span>
                </div>
                <div className={`px-4 py-2 rounded-2xl text-xs max-w-[85%] break-words border shadow-2xl ${
                  isMe 
                    ? (isPrivate ? 'bg-amber-600 border-amber-500' : 'bg-indigo-600 border-indigo-500') + ' text-white rounded-tr-none' 
                    : 'bg-[#121218] border-white/5 text-slate-300 rounded-tl-none'
                }`}>
                  {msg.text}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3 bg-black/40 border-t border-white/5 shrink-0 mb-14 md:mb-0">
          <form onSubmit={handleSubmit} className="relative">
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={recipient === 'everyone' ? "Type to Everyone..." : `Chat with ${recipientUser?.name}...`}
              className={`w-full bg-[#0e0e12] border rounded-xl pl-4 pr-12 py-3 text-xs text-slate-300 outline-none transition-all shadow-inner ${recipient === 'everyone' ? 'border-white/10 focus:border-indigo-500' : 'border-amber-500/50 focus:border-amber-500'}`}
            />
            <button type="submit" disabled={!inputText.trim()} className={`absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center ${recipient === 'everyone' ? 'text-indigo-500' : 'text-amber-500'} hover:bg-white/5 disabled:opacity-20 transition-all`}>
              <i className="fas fa-paper-plane text-xs"></i>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
