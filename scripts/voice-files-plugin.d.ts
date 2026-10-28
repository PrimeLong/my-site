import type { Plugin } from 'vite';
export function listVoiceFiles(dir?: string): string[];
export function listBookAudio(): string[];
export default function voiceFiles(): Plugin;
