
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

export interface ProjectFile {
  name: string;
  language: string;
  content: string;
}

// Fix: Adding missing SharedFile interface for the resources panel
export interface SharedFile {
  id: string;
  name: string;
  size: string;
  uploadedBy: string;
  timestamp: number;
  dataUrl?: string;
}

export enum Language {
  C = 'c',
  Java = 'java',
  Python = 'python',
  Javascript = 'javascript',
  HTML = 'html',
  React = 'react'
}
