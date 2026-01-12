
import React, { useState, useRef, useEffect } from 'react';
import { SharedFile, User } from '../types';
import { supabase } from '../services/supabase';

interface FilePanelProps {
  roomId: string;
  currentUser: User;
}

const FilePanel: React.FC<FilePanelProps> = ({ roomId, currentUser }) => {
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isHost = currentUser.role === 'host';

  const fetchFiles = async () => {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false });
    
    if (data) setFiles(data);
  };

  useEffect(() => {
    fetchFiles();
    const channel = supabase.channel(`f_${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'files', filter: `room_id=eq.${roomId}` }, fetchFiles)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) return alert("Max size 5MB");
      setIsUploading(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        await supabase.from('files').insert({
          room_id: roomId,
          name: file.name,
          size: (file.size / 1024).toFixed(1) + ' KB',
          uploaded_by: currentUser.name,
          data_url: dataUrl
        });
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDownload = (file: SharedFile) => {
    try {
      // Create a Blob from the data URL for more reliable downloads
      const parts = file.data_url.split(',');
      const byteString = atob(parts[1]);
      const mimeString = parts[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
      
      const blob = new Blob([ab], { type: mimeString });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert("Download error.");
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0b0b0f] overflow-hidden">
      <div className="h-14 flex items-center justify-between px-6 bg-[#121218] border-b border-white/5 shrink-0">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Assets Library</span>
        {isHost && (
          <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="btn-primary h-8 px-4 rounded-xl text-[10px] font-black uppercase text-white disabled:opacity-50">
            {isUploading ? "Uploading..." : "Share File"}
          </button>
        )}
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
      </div>
      <div className="flex-1 p-4 md:p-6 space-y-3 overflow-y-auto custom-scrollbar scroll-container">
        {files.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-30 text-slate-500">
            <i className="fas fa-folder-open text-4xl mb-3"></i>
            <span className="text-[10px] font-black uppercase tracking-widest">No shared resources</span>
          </div>
        ) : (
          files.map(file => (
            <div key={file.id} className="group flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-indigo-500/30 transition-all">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                  <i className="fas fa-file-code"></i>
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-200 truncate">{file.name}</h4>
                  <p className="text-[9px] text-slate-500 uppercase tracking-wider">{file.size} • By {file.uploaded_by}</p>
                </div>
              </div>
              <button onClick={() => handleDownload(file)} className="w-10 h-10 rounded-xl bg-white/5 text-slate-400 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center border border-white/5">
                <i className="fas fa-download text-xs"></i>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FilePanel;
