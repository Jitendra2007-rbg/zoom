
import React, { useState, useRef, useEffect } from 'react';
import { SharedFile, User } from '../types';
import { supabase, uploadRoomFile, deleteRoomFile } from '../services/supabase';

interface FilePanelProps {
  roomId: string;
  currentUser: User;
}

const FilePanel: React.FC<FilePanelProps> = ({ roomId, currentUser }) => {
  const [files, setFiles] = useState<SharedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isHost = currentUser.role === 'host';

  useEffect(() => {
    const fetchFiles = async () => {
      const { data } = await supabase.from('files').select('*').eq('room_id', roomId).order('created_at', { ascending: false });
      if (data) setFiles(data);
    };

    fetchFiles();

    const channel = supabase
      .channel(`files:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'files', filter: `room_id=eq.${roomId}` }, fetchFiles)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        const newFile = {
          name: file.name,
          size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
          uploadedBy: currentUser.name,
          dataUrl: dataUrl
        };
        await uploadRoomFile(roomId, newFile);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDelete = async (fileId: string) => {
    if (confirm("Delete this shared resource?")) {
      await deleteRoomFile(fileId);
    }
  };

  const handleDownload = (file: SharedFile) => {
    if (!file.dataUrl) return;
    const link = document.createElement('a');
    link.href = file.dataUrl;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="h-full flex flex-col bg-[#0b0b0f]">
      <div className="h-12 flex items-center justify-between px-6 bg-[#121218] border-b border-white/5 shrink-0">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Shared Assets</span>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
        <button onClick={() => fileInputRef.current?.click()} className="h-8 px-4 rounded-xl text-[10px] font-black bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all flex items-center gap-2 uppercase tracking-widest">
          <i className="fas fa-upload"></i> Share File
        </button>
      </div>
      <div className="flex-1 p-4 md:p-6 space-y-3 overflow-y-auto custom-scrollbar">
        {files.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-700 opacity-40">
            <i className="fas fa-cloud-upload-alt text-4xl mb-4"></i>
            <p className="text-[10px] uppercase font-bold tracking-[0.3em]">No shared files</p>
          </div>
        ) : (
          files.map(file => (
            <div key={file.id} className="group flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-indigo-500/30 transition-all hover:bg-indigo-500/5 shadow-lg">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                  <i className="fas fa-file-code"></i>
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-200 truncate">{file.name}</h4>
                  <p className="text-[9px] text-slate-500 uppercase tracking-wider">{file.size} • By {file.uploadedBy}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-indigo-600 text-slate-400 hover:text-white transition-all flex items-center justify-center border border-white/5"
                  onClick={() => handleDownload(file)}
                >
                  <i className="fas fa-download text-xs"></i>
                </button>
                {isHost && (
                  <button 
                    className="w-10 h-10 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white transition-all flex items-center justify-center border border-white/5"
                    onClick={() => handleDelete(file.id)}
                  >
                    <i className="fas fa-trash text-xs"></i>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FilePanel;
