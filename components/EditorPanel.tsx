
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
  [Language.Javascript]: [{ name: 'index.js', language: 'javascript', content: `console.log("Welcome to Codex!");` }],
  [Language.Python]: [{ name: 'main.py', language: 'python', content: `print("Welcome to Codex!")` }],
  [Language.Java]: [{ name: 'Main.java', language: 'java', content: `public class Main { public static void main(String[] args) { System.out.println("Hello!"); } }` }],
  [Language.C]: [{ name: 'main.c', language: 'c', content: `#include <stdio.h>\nint main() { printf("Hello!\\n"); return 0; }` }],
  [Language.HTML]: [{ name: 'index.html', language: 'html', content: `<h1>Hello World</h1>` }],
  [Language.React]: [{ name: 'App.jsx', language: 'javascript', content: `export default function App() { return <h1>Hello from Codex</h1> }` }]
};

const EditorPanel: React.FC<EditorPanelProps> = ({ user, isLocked, isPracticeMode, onLanguageChange, sharedCode, onCodeChange }) => {
  const [language, setLanguage] = useState<Language>(Language.Javascript);
  const [content, setContent] = useState('');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [terminalVisible, setTerminalVisible] = useState(false);

  // Sync logic: Force content update from host if not in practice mode
  useEffect(() => {
    if (!isPracticeMode && sharedCode !== undefined) {
      setContent(sharedCode);
    }
  }, [sharedCode, isPracticeMode]);

  // Initial content setup
  useEffect(() => {
    if (!content && sharedCode) {
      setContent(sharedCode);
    } else if (!content) {
      setContent(BOILERPLATES[language][0].content);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    if (!isPracticeMode && (user.role === 'host' || !isLocked)) {
      onCodeChange?.(val);
    }
  };

  const handleRun = async () => {
    setIsRunning(true);
    setTerminalVisible(true);
    setOutput("Compiling...");
    const result = await executeCode(content, language);
    setOutput(result);
    setIsRunning(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#0b0b0f] min-h-0 relative">
      <div className="h-10 flex items-center justify-between px-4 bg-[#121218] border-b border-white/5 shrink-0">
        <div className="flex items-center gap-4">
          <select 
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="bg-transparent text-[10px] font-black text-indigo-400 outline-none uppercase tracking-widest cursor-pointer"
          >
            {Object.values(Language).map(l => <option key={l} value={l} className="bg-[#121218]">{l}</option>)}
          </select>
          {isPracticeMode && <span className="text-[8px] font-black text-amber-500 uppercase bg-amber-500/10 px-2 py-1 rounded">Private Draft</span>}
        </div>
        <button onClick={handleRun} disabled={isRunning} className="h-7 px-4 rounded-lg text-[9px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-widest hover:bg-emerald-500/20 transition-all">
          {isRunning ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-play mr-2"></i>} Run Code
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <textarea
          value={content}
          onChange={handleChange}
          readOnly={isLocked && !isPracticeMode && user.role !== 'host'}
          spellCheck={false}
          className="flex-1 bg-transparent p-6 text-slate-300 font-mono text-sm leading-relaxed outline-none resize-none custom-scrollbar"
          placeholder="// Start coding..."
        />
      </div>

      <div className={`absolute bottom-0 inset-x-0 transition-all duration-300 ${terminalVisible ? 'h-1/3' : 'h-0'} overflow-hidden bg-[#050507] border-t border-white/10 flex flex-col z-[100]`}>
        <div className="h-8 flex items-center justify-between px-4 bg-black/40 border-b border-white/5">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Console Output</span>
          <button onClick={() => setTerminalVisible(false)} className="text-slate-600 hover:text-white"><i className="fas fa-times"></i></button>
        </div>
        <div className="flex-1 p-4 font-mono text-xs overflow-y-auto custom-scrollbar text-emerald-400">
          <pre className="whitespace-pre-wrap">{output || "> Idle"}</pre>
        </div>
      </div>
    </div>
  );
};

export default EditorPanel;
