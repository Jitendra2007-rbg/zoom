
export type Role = 'host' | 'editor' | 'viewer';

export interface User {
  id: string;
  name: string;
  role: Role;
  color: string;
  isMuted?: boolean;
  isCamOff?: boolean;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  user_name: string;
  text: string;
  created_at: string;
}

export interface SharedFile {
  id: string;
  name: string;
  size: string;
  uploaded_by: string;
  created_at: string;
  data_url: string;
}

export interface ProjectFile {
  name: string;
  language: string;
  content: string;
}

export enum Language {
  C = 'c',
  CPP = 'cpp',
  Java = 'java',
  Python = 'python',
  Javascript = 'javascript',
  Typescript = 'typescript',
  Rust = 'rust',
  Go = 'go',
  PHP = 'php',
  Ruby = 'ruby',
  HTML = 'html',
  CSS = 'css',
  React = 'react'
}

export interface SignalingMessage {
  from: string;
  to: string;
  type: 'offer' | 'answer' | 'candidate';
  payload: any;
}
