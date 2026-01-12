
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

const EditorPanel: React.FC<EditorPanelProps> = ({ user, isLocked, isPracticeMode, sharedCode, onCodeChange, onTogglePractice }) => {
  const [language, setLanguage] = useState<Language>(Language.Javascript);
  const [content, setContent] = useState('');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [terminalVisible, setTerminalVisible] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const lastLocalUpdateRef = useRef<string>('');

  useEffect(() => {
    if (!isPracticeMode && sharedCode !== undefined && sharedCode !== content && sharedCode !== lastLocalUpdateRef.current) {
      if (user.role !== 'host') {
        setContent(sharedCode);
      }
    }
  }, [sharedCode, isPracticeMode, user.role, content]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    lastLocalUpdateRef.current = val;
    if (!isPracticeMode && (user.role === 'host' || !isLocked)) {
      onCodeChange?.(val);
    }
  };

  const analyzeMistakes = () => {
    if (!sharedCode) return [{ type: 'info', msg: "Teacher hasn't written any code yet." }];
    
    const issues = [];
    
    // 1. Bracket Matching Check
    const brackets = [
      { open: '{', close: '}', name: 'Braces' },
      { open: '(', close: ')', name: 'Parentheses' },
      { open: '[', close: ']', name: 'Brackets' }
    ];

    brackets.forEach(b => {
      const studentOpen = (content.match(new RegExp('\\' + b.open, 'g')) || []).length;
      const studentClose = (content.match(new RegExp('\\' + b.close, 'g')) || []).length;
      const hostOpen = (sharedCode.match(new RegExp('\\' + b.open, 'g')) || []).length;

      if (studentOpen !== studentClose) {
        issues.push({ type: 'error', msg: `Unbalanced ${b.name}: You have ${studentOpen} '${b.open}' but ${studentClose} '${b.close}'.` });
      }
      if (studentOpen < hostOpen) {
        issues.push({ type: 'warning', msg: `Missing Structure: Teacher has ${hostOpen} sets of ${b.name}, you only have ${studentOpen}.` });
      }
    });

    // 2. Semicolon Check (Basic)
    if (language === Language.Javascript || language === Language.Java || language === Language.CPP) {
      const studentSemi = (content.match(/;/g) || []).length;
      const hostSemi = (sharedCode.match(/;/g) || []).length;
      if (studentSemi < hostSemi - 2) { // Allow slight deviation
        issues.push({ type: 'warning', msg: `Possible missing semicolons (;) compared to teacher.` });
      }
    }

    // 3. Line Count Deviation
    const studentLines = content.split('\n').filter(l => l.trim()).length;
    const hostLines = sharedCode.split('\n').filter(l => l.trim()).length;
    if (Math.abs(studentLines - hostLines) > 5) {
      issues.push({ type: 'info', msg: `Significant line count difference (${studentLines} vs ${hostLines}). Check for missing logic.` });
    }

    if (issues.length === 0) return [{ type: 'success', msg: "Structure looks clean! Ready to run." }];
    return issues;
  };

  return (
    <div className="flex flex-col h-full bg-[#0b0b0f] min-h-0 relative">
      <div className="h-12 flex items-center justify-between px-4 bg-[#121218] border-b border-white/5 shrink-0 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-3 shrink-0">
          <select 
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            disabled={!isPracticeMode && user.role !== 'host'}
            className="bg-transparent text-[10px] font-black text-indigo-400 outline-none uppercase tracking-widest cursor-pointer"
          >
            {Object.values(Language).map(l => <option key={l} value={l} className="bg-[#121218]">{l.toUpperCase()}</option>)}
          </select>
          
          <button onClick={onTogglePractice} className={`h-7 px-3 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all border ${isPracticeMode ? 'bg-amber-500 border-amber-400 text-white shadow-lg' : 'bg-white/5 border-white/10 text-slate-500'}`}>
            <i className="fas fa-flask mr-1"></i> Solo
          </button>

          {user.role !== 'host' && !isPracticeMode && (
            <button onClick={() => setCompareMode(!compareMode)} className={`h-7 px-3 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all border ${compareMode ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-indigo-400'}`}>
              <i className="fas fa-columns mr-1"></i> Compare Mode
            </button>
          )}
        </div>
        
        <button onClick={async () => {
          setIsRunning(true);
          setTerminalVisible(true);
          setOutput(await executeCode(content, language));
          setIsRunning(false);
        }} disabled={isRunning} className="h-8 px-4 rounded-lg text-[9px] font-black bg-emerald-500 text-white uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-lg">
          {isRunning ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-play mr-1"></i>} Run
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {compareMode && !isPracticeMode && (
          <div className="w-1/2 flex flex-col border-r border-white/10 bg-black/20">
            <div className="h-8 px-4 flex items-center bg-indigo-500/10 border-b border-indigo-500/20">
              <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Teacher's reference</span>
            </div>
            <textarea
              readOnly
              value={sharedCode || ''}
              className="flex-1 bg-transparent p-4 text-slate-500 font-mono text-xs leading-relaxed outline-none resize-none cursor-default no-scrollbar"
            />
            <div className="p-4 bg-indigo-900/10 border-t border-indigo-500/10 max-h-48 overflow-y-auto custom-scrollbar">
              <div className="text-[9px] font-black text-indigo-400 uppercase mb-3 flex items-center gap-2">
                 <i className="fas fa-microchip"></i> Structural Analysis
              </div>
              <div className="space-y-2">
                {analyzeMistakes().map((issue, i) => (
                  <div key={i} className={`text-[10px] font-bold p-2 rounded-lg flex items-start gap-2 ${
                    issue.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
                    issue.type === 'warning' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
                    issue.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    'bg-white/5 text-slate-400 border border-white/10'
                  }`}>
                    <i className={`fas ${issue.type === 'error' ? 'fa-times-circle' : issue.type === 'warning' ? 'fa-exclamation-triangle' : issue.type === 'success' ? 'fa-check-circle' : 'fa-info-circle'} mt-0.5`}></i>
                    <span>{issue.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col relative min-w-0">
          <textarea
            value={content}
            onChange={handleChange}
            readOnly={isLocked && !isPracticeMode && user.role !== 'host'}
            spellCheck={false}
            className="flex-1 bg-transparent p-4 md:p-6 text-slate-300 font-mono text-sm leading-relaxed outline-none resize-none scroll-container custom-scrollbar"
            placeholder="// Start coding..."
          />
        </div>
      </div>

      <div className={`absolute bottom-0 inset-x-0 transition-all duration-300 ${terminalVisible ? 'h-1/3' : 'h-0'} overflow-hidden bg-[#050507] border-t border-white/10 flex flex-col z-[100]`}>
        <div className="h-8 flex items-center justify-between px-4 bg-black/40 border-b border-white/5">
          <span className="text-[9px] font-black text-slate-500 uppercase">Output</span>
          <button onClick={() => setTerminalVisible(false)} className="text-slate-600 hover:text-white"><i className="fas fa-times"></i></button>
        </div>
        <div className="flex-1 p-4 font-mono text-xs overflow-y-auto custom-scrollbar text-emerald-400 scroll-container">
          <pre className="whitespace-pre-wrap">{output || "> System ready..."}</pre>
        </div>
      </div>
    </div>
  );
};

export default EditorPanel;
