import type { Plugin } from 'vite';

export type SectionIndex = Record<string, { id: string; title: string; minutes: number; recall: string }[]>;
export function buildSectionIndex(dir?: string): SectionIndex;
export default function textbookSections(): Plugin;
