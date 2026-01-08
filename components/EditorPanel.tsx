
import React, { useState, useRef, useEffect } from 'react';
import { executeCode } from '../services/geminiService';
import { Language, User, ProjectFile } from '../types';

interface EditorPanelProps {
  user: User;
  isLocked: boolean;
  isPracticeMode?: boolean;
  onLanguageChange?: (lang: Language) => void;
  sharedCode?: string;
  onCodeChange?: (code: string) => void;
}

const BOILERPLATES: Record<string, ProjectFile[]> = {
  [Language.Javascript]: [{ name: 'index.js', language: 'javascript', content: `console.log("Hello from Codex!");` }],
  [Language.Python]: [{ name: 'main.py', language: 'python', content: `print("Hello from Codex!")` }],
  [Language.Java]: [{ name: 'Main.java', language: 'java', content: `public class Main { public static void main(String[] args) { System.out.println("Hello!"); } }` }],
  [Language.C]: [{ name: 'main.c', language: 'c', content: `#include <stdio.h>\nint main() { printf("Hello!\\n"); return 0; }` }],
  [Language.HTML]: [{ name: 'index.html', language: 'html', content: `<h1>Hello!</h1>` }],
  [Language.React]: [{ name: 'App.jsx', language: 'javascript', content: `export default function App() { return <h1>Hello!</h1> }` }]
};

const EditorPanel: React.FC<EditorPanelProps> = ({ user, isLocked, isPracticeMode, onLanguageChange, sharedCode, onCodeChange }) => {
  const [language, setLanguage] = useState<Language>(Language.Javascript);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>(BOILERPLATES[Language.Javascript]);
  const [output, setOutput] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [terminalVisible, setTerminalVisible] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync from Shared Code
  useEffect(() => {
    if (!isPracticeMode && sharedCode !== undefined && sharedCode !== projectFiles[activeFileIndex].content) {
      const newFiles = [...projectFiles];
      if (newFiles[activeFileIndex]) {
        newFiles[activeFileIndex].content = sharedCode;
        setProjectFiles(newFiles);
      }
    }
  }, [sharedCode, isPracticeMode]);

  const activeFile = projectFiles[activeFileIndex];

  const handleLanguageChange = (newLang: Language) => {
    setLanguage(newLang);
    setProjectFiles(BOILERPLATES[newLang]);
    setActiveFileIndex(0);
    onLanguageChange?.(newLang);
  };

  const updateContent = (content: string) => {
    const newFiles = [...projectFiles];
    newFiles[activeFileIndex].content = content;
    setProjectFiles(newFiles);
    if (!isPracticeMode) {
      onCodeChange?.(content);
    }
  };

  const handleRun = async () => {
    setIsRunning(true);
    setTerminalVisible(true);
    const result = await executeCode(activeFile.content, language);
    setOutput(result);
    setIsRunning(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#0b0b0f] min-h-0 relative">
      <div className="flex items-center justify-between px-4 py-2 bg-[#121218] border-b border-white/5 shrink-0 overflow-x-auto custom-scrollbar">
        <div className="flex items-center gap-4 shrink-0">
          <select 
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value as Language)}
            className="bg-transparent text-[10px] font-black text-indigo-400 outline-none uppercase tracking-widest"
          >
            {Object.values(Language).map(l => <option key={l} value={l} className="bg-[#121218]">{l.toUpperCase()}</option>)}
          </select>
          <div className="flex items-center gap-1">
            {projectFiles.map((file, idx) => (
              <button key={file.name} onClick={() => setActiveFileIndex(idx)} className={`px-3 py-1 rounded-md text-[9px] font-bold uppercase ${activeFileIndex === idx ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>
                {file.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isPracticeMode && <span className="text-[8px] font-black text-amber-500 uppercase bg-amber-500/10 px-2 py-1 rounded-lg">Practice Mode</span>}
          <button onClick={handleRun} disabled={isRunning || (isLocked && !isPracticeMode)} className="h-7 px-4 rounded-lg text-[9px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-widest flex items-center gap-2">
            {isRunning ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-play"></i>} Run
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">
        <div className="hidden md:flex w-12 flex-col items-center pt-6 bg-[#0b0b0f] text-slate-800 border-r border-white/5 font-mono text-[10px] select-none shrink-0 overflow-y-hidden">
          {[...Array(50)].map((_, i) => <div key={i} className="h-6 leading-6">{i + 1}</div>)}
        </div>
        <textarea
          ref={textareaRef}
          value={activeFile.content}
          onChange={(e) => updateContent(e.target.value)}
          readOnly={isLocked && !isPracticeMode}
          spellCheck={false}
          className="flex-1 bg-transparent p-6 text-slate-300 font-mono text-sm leading-6 outline-none resize-none custom-scrollbar overflow-y-auto w-full"
          placeholder="// Write code..."
        />
      </div>

      <div className={`absolute bottom-0 inset-x-0 transition-all duration-300 ${terminalVisible ? 'h-1/3' : 'h-0'} overflow-hidden bg-[#050507] border-t border-white/10 flex flex-col z-50`}>
        <div className="h-8 flex items-center justify-between px-4 bg-black/40 border-b border-white/5 shrink-0">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Output</span>
          <button onClick={() => setTerminalVisible(false)} className="text-slate-600 hover:text-white p-1"><i className="fas fa-times text-xs"></i></button>
        </div>
        <div className="flex-1 p-4 font-mono text-xs overflow-y-auto custom-scrollbar text-emerald-400">
          <pre className="whitespace-pre-wrap">{output || "Idle..."}</pre>
        </div>
      </div>
    </div>
  );
};

export default EditorPanel;
