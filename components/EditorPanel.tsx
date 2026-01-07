
import React, { useState, useRef, useEffect } from 'react';
import { executeCode, explainCode } from '../services/geminiService';
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
  [Language.Javascript]: [{ name: 'index.js', language: 'javascript', content: `// JavaScript Hello World\nfunction greet(name) {\n  console.log("Hello, " + name + "!");\n}\n\ngreet("Codex User");` }],
  [Language.Python]: [{ name: 'main.py', language: 'python', content: `# Python Hello World\ndef main():\n    name = "Codex User"\n    print(f"Hello, {name}!")\n\nif __name__ == "__main__":\n    main()` }],
  [Language.Java]: [{ name: 'Main.java', language: 'java', content: `import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, Codex User!");\n        \n        List<String> items = new ArrayList<>();\n        items.add("Java Persistence");\n        items.add("Real-time Collaboration");\n        \n        for (String item : items) {\n            System.out.println("Feature: " + item);\n        }\n    }\n}` }],
  [Language.C]: [{ name: 'main.c', language: 'c', content: `#include <stdio.h>\n\nint main() {\n    printf("Hello, Codex User!\\n");\n    return 0;\n}` }],
  [Language.HTML]: [
    { name: 'index.html', language: 'html', content: `<!DOCTYPE html>\n<html>\n<head>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>Hello World</h1>\n  <button id="btn">Click Me</button>\n  <script src="script.js"></script>\n</body>\n</html>` },
    { name: 'style.css', language: 'css', content: `body {\n  background: #0f172a;\n  color: white;\n  font-family: sans-serif;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  height: 100vh;\n  margin: 0;\n}\nh1 { color: #6366f1; }` },
    { name: 'script.js', language: 'javascript', content: `document.getElementById('btn').addEventListener('click', () => {\n  alert('Hello from Codex!');\n});` }
  ],
  [Language.React]: [{ name: 'App.jsx', language: 'javascript', content: `import React, { useState } from 'react';\n\nexport default function App() {\n  const [count, setCount] = useState(0);\n\n  return (\n    <div className="p-8 text-center">\n      <h1 className="text-3xl font-bold text-indigo-500 mb-4">React Playground</h1>\n      <p className="mb-4">Count: {count}</p>\n      <button \n        onClick={() => setCount(c => c + 1)}\n        className="px-4 py-2 bg-indigo-600 text-white rounded-lg"\n      >\n        Increment\n      </button>\n    </div>\n  );\n}` }]
};

const SUGGESTIONS: Record<string, string[]> = {
  javascript: ['console.log', 'function', 'const', 'let', 'return', 'async', 'await', 'import', 'export', 'useState', 'useEffect'],
  python: ['print', 'def', 'class', 'import', 'from', 'if __name__ == "__main__":'],
  java: ['System.out.println', 'public class', 'public static void main', 'ArrayList', 'Scanner'],
  html: ['div', 'span', 'section', 'header', 'footer', 'script', 'link']
};

const EditorPanel: React.FC<EditorPanelProps> = ({ user, isLocked, isPracticeMode, onLanguageChange, sharedCode, onCodeChange }) => {
  const [language, setLanguage] = useState<Language>(Language.Javascript);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>(BOILERPLATES[Language.Javascript]);
  const [output, setOutput] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [terminalVisible, setTerminalVisible] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionPos, setSuggestionPos] = useState({ top: 0, left: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isPracticeMode && sharedCode !== undefined) {
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

  const updateActiveContent = (content: string) => {
    const newFiles = [...projectFiles];
    newFiles[activeFileIndex].content = content;
    setProjectFiles(newFiles);
    if (!isPracticeMode) {
      onCodeChange?.(content);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isLocked && !isPracticeMode) return;

    if (suggestions.length > 0) {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applySuggestion(suggestions[0]);
        return;
      }
      if (e.key === 'Escape') {
        setSuggestions([]);
        return;
      }
    }

    const pairs: Record<string, string> = { '(': ')', '{': '}', '[': ']', '"': '"', "'": "'" };
    if (pairs[e.key]) {
      e.preventDefault();
      const start = textareaRef.current!.selectionStart;
      const end = textareaRef.current!.selectionEnd;
      const val = activeFile.content.substring(0, start) + e.key + pairs[e.key] + activeFile.content.substring(end);
      updateActiveContent(val);
      setTimeout(() => {
        textareaRef.current!.selectionStart = textareaRef.current!.selectionEnd = start + 1;
      }, 0);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    updateActiveContent(val);

    const pos = e.target.selectionStart;
    const lastWord = val.substring(0, pos).split(/[\s\n().,;{}[\]]/).pop();
    
    if (lastWord && lastWord.length >= 1) {
      const filtered = SUGGESTIONS[language.toLowerCase()]?.filter(s => s.startsWith(lastWord)) || [];
      if (filtered.length > 0 && filtered[0] !== lastWord) {
        setSuggestions(filtered);
        const lines = val.substring(0, pos).split('\n');
        setSuggestionPos({ top: lines.length * 24 + 40, left: (lines[lines.length - 1].length) * 8 + 60 });
      } else {
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
    }
  };

  const applySuggestion = (suggestion: string) => {
    const pos = textareaRef.current!.selectionStart;
    const before = activeFile.content.substring(0, pos);
    const after = activeFile.content.substring(pos);
    const words = before.split(/([\s\n().,;{}[\]])/);
    words[words.length - 1] = suggestion;
    updateActiveContent(words.join('') + after);
    setSuggestions([]);
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
            className="bg-transparent text-[10px] font-black text-indigo-400 focus:outline-none border-none uppercase tracking-widest"
          >
            {Object.values(Language).map(l => <option key={l} value={l} className="bg-[#121218]">{l.toUpperCase()}</option>)}
          </select>
          
          <div className="flex items-center gap-1">
            {projectFiles.map((file, idx) => (
              <button 
                key={file.name}
                onClick={() => setActiveFileIndex(idx)}
                className={`px-3 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${activeFileIndex === idx ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                {file.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isPracticeMode && <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">Practice Mode</span>}
          <button onClick={handleRun} disabled={isRunning || (isLocked && !isPracticeMode)} className="h-7 px-4 rounded-lg text-[9px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all uppercase tracking-widest flex items-center gap-2">
            {isRunning ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-play"></i>} Run
          </button>
        </div>
      </div>

      <div className="flex-1 relative flex overflow-hidden min-h-0">
        {suggestions.length > 0 && (
          <div className="absolute z-[100] bg-[#1a1a24] border border-white/10 rounded-lg shadow-2xl overflow-hidden min-w-[150px]" style={{ top: suggestionPos.top, left: Math.min(suggestionPos.left, 200) }}>
            {suggestions.slice(0, 5).map(s => (
              <div key={s} onClick={() => applySuggestion(s)} className="px-3 py-2 text-[10px] font-mono cursor-pointer hover:bg-indigo-600 text-slate-300 hover:text-white border-b border-white/5 last:border-0 flex justify-between items-center">
                <span>{s}</span>
                <span className="text-[7px] opacity-30">AUTO</span>
              </div>
            ))}
          </div>
        )}

        <div className="hidden md:flex w-12 flex-col items-center pt-6 bg-[#0b0b0f] text-slate-800 border-r border-white/5 font-mono text-[10px] select-none shrink-0 overflow-y-hidden">
          {[...Array(100)].map((_, i) => <div key={i} className="h-6 leading-6">{i + 1}</div>)}
        </div>

        <textarea
          ref={textareaRef}
          value={activeFile.content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          readOnly={isLocked && !isPracticeMode}
          spellCheck={false}
          className="flex-1 bg-transparent p-6 text-slate-300 font-mono text-sm leading-6 outline-none resize-none custom-scrollbar overflow-y-auto selection:bg-indigo-500/30 w-full"
          placeholder="// Code goes here..."
        />
      </div>

      <div className={`absolute bottom-0 inset-x-0 transition-all duration-300 ${terminalVisible ? 'h-1/3' : 'h-0'} overflow-hidden bg-[#050507] border-t border-white/10 flex flex-col z-50`}>
        <div className="h-8 flex items-center justify-between px-4 bg-black/40 border-b border-white/5 shrink-0">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Console Output</span>
          <button onClick={() => setTerminalVisible(false)} className="text-slate-600 hover:text-white p-1"><i className="fas fa-times text-xs"></i></button>
        </div>
        <div className="flex-1 p-4 font-mono text-xs overflow-y-auto custom-scrollbar text-emerald-400">
          <pre className="whitespace-pre-wrap">{output || "Waiting for execution..."}</pre>
        </div>
      </div>
    </div>
  );
};

export default EditorPanel;
