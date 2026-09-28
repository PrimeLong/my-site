import type { Plugin } from 'vite';

export function renderServiceWorker(assets: Iterable<string>, template?: string): string;
export default function serviceWorker(): Plugin;
