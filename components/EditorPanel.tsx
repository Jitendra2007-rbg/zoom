
import React, { useState, useRef, useEffect } from 'react';
import { executeCode } from '../services/codeExecutionService';
import { Language, User, ProjectFile } from '../types';

interface EditorPanelProps {
  user: User;
  isLocked: boolean;
  isPracticeMode?: boolean;
  onTogglePractice?: () => void;
  onLanguageChange?: (lang: Language) => void;
  sharedCode?: string;
  onCodeChange?: (code: string) => void;
}

const BOILERPLATES: Record<string, ProjectFile[]> = {
  [Language.Javascript]: [{ name: 'index.js', language: 'javascript', content: `console.log("Welcome to Codex Collab!");` }],
  [Language.Typescript]: [{ name: 'index.ts', language: 'typescript', content: `const greeting: string = "Hello TypeScript!";\nconsole.log(greeting);` }],
  [Language.Python]: [{ name: 'main.py', language: 'python', content: `print("Hello from Python!")` }],
  [Language.Java]: [{ name: 'Main.java', language: 'java', content: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello Java!");\n    }\n}` }],
  [Language.C]: [{ name: 'main.c', language: 'c', content: `#include <stdio.h>\n\nint main() {\n    printf("Hello C!\\n");\n    return 0;\n}` }],
  [Language.CPP]: [{ name: 'main.cpp', language: 'cpp', content: `#include <iostream>\n\nint main() {\n    std::cout << "Hello C++!" << std::endl;\n    return 0;\n}` }],
  [Language.Rust]: [{ name: 'main.rs', language: 'rust', content: `fn main() {\n    println!("Hello Rust!");\n}` }],
  [Language.Go]: [{ name: 'main.go', language: 'go', content: `package main\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello Go!")\n}` }],
  [Language.PHP]: [{ name: 'index.php', language: 'php', content: `<?php\necho "Hello PHP!";` }],
  [Language.Ruby]: [{ name: 'main.rb', language: 'ruby', content: `puts "Hello Ruby!"` }],
  [Language.HTML]: [{ name: 'index.html', language: 'html', content: `<!DOCTYPE html>\n<html><body><h1>Hello HTML</h1></body></html>` }],
  [Language.CSS]: [{ name: 'style.css', language: 'css', content: `body {\n  background: #000;\n  color: #fff;\n}` }],
  [Language.React]: [{ name: 'App.jsx', language: 'javascript', content: `export default function App() {\n  return <h1>Hello React</h1>;\n}` }]
};

const EditorPanel: React.FC<EditorPanelProps> = ({ user, isLocked, isPracticeMode, onTogglePractice, sharedCode, onCodeChange }) => {
  const [language, setLanguage] = useState<Language>(Language.Javascript);
  const [content, setContent] = useState('');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [terminalVisible, setTerminalVisible] = useState(false);
  const lastUpdateRef = useRef<string>('');

  useEffect(() => {
    if (!isPracticeMode && sharedCode !== undefined && sharedCode !== content && sharedCode !== lastUpdateRef.current) {
      if (user.role !== 'host') setContent(sharedCode);
    }
  }, [sharedCode, isPracticeMode, user.role]);

  useEffect(() => {
    if (!content && !sharedCode) setContent(BOILERPLATES[language][0].content);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    lastUpdateRef.current = val;
    if (!isPracticeMode && (user.role === 'host' || !isLocked)) onCodeChange?.(val);
  };

  const handleRun = async () => {
    setIsRunning(true);
    setTerminalVisible(true);
    setOutput("Executing...");
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
            onChange={(e) => {
              const l = e.target.value as Language;
              setLanguage(l);
              const newContent = BOILERPLATES[l][0].content;
              setContent(newContent);
              if (user.role === 'host') onCodeChange?.(newContent);
            }}
            disabled={!isPracticeMode && user.role !== 'host'}
            className="bg-transparent text-[10px] font-black text-indigo-400 outline-none uppercase tracking-widest cursor-pointer disabled:opacity-50"
          >
            {Object.values(Language).map(l => <option key={l} value={l} className="bg-[#121218]">{l.toUpperCase()}</option>)}
          </select>
          
          {user.role !== 'host' && (
            <button 
              onClick={onTogglePractice}
              className={`h-6 px-3 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all border ${isPracticeMode ? 'bg-amber-500 border-amber-400 text-white shadow-lg' : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'}`}
            >
              <i className="fas fa-flask mr-1"></i> {isPracticeMode ? 'Practice: ON' : 'Join Solo Practice'}
            </button>
          )}
        </div>
        <button onClick={handleRun} disabled={isRunning} className="h-7 px-4 rounded-lg text-[9px] font-black bg-emerald-500 text-white uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20">
          {isRunning ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-play mr-2"></i>} Run
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <textarea
          value={content}
          onChange={handleChange}
          readOnly={isLocked && !isPracticeMode && user.role !== 'host'}
          spellCheck={false}
          className="flex-1 bg-transparent p-6 text-slate-300 font-mono text-sm leading-relaxed outline-none resize-none custom-scrollbar"
        />
      </div>

      <div className={`absolute bottom-0 inset-x-0 transition-all duration-300 ${terminalVisible ? 'h-1/3' : 'h-0'} overflow-hidden bg-[#050507] border-t border-white/10 flex flex-col z-[100]`}>
        <div className="h-8 flex items-center justify-between px-4 bg-black/40 border-b border-white/5">
          <span className="text-[9px] font-black text-slate-500 uppercase">Output</span>
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
