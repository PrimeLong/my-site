import type { Plugin } from 'vite';
export function listVoiceFiles(dir?: string): string[];
export function listBookAudio(): string[];
export function listPeoplePhotos(dir?: string): Record<string, string>;
export function parseCredits(text: string): Record<string, { author: string; license: string; source: string }>;
export function readPhotoCredits(file?: string): Record<string, { author: string; license: string; source: string }>;
export default function voiceFiles(): Plugin;
