import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { CHAPTER_TEXT, CHAPTER_BLOCKS } from '../content.js';

/* Главы учебника — динамические импорты (каждая — свой чанк), а модуль content.js ждёт их
   все: для тех, кто его импортирует, данные по-прежнему синхронные. */
describe('главы — отдельными чанками', () => {
  const files = readdirSync(new URL('../chapters/', import.meta.url)).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''));
  it('content.js загрузил все главы и разобрал их в блоки', () => {
    expect(Object.keys(CHAPTER_TEXT).sort()).toEqual(files.sort());
    files.forEach((id) => expect(CHAPTER_BLOCKS[id].length, id).toBeGreaterThan(0));
  });
  it('главы подключены ленивым import.meta.glob, а не eager: иначе 600 КБ текста едут в чанке учебника', () => {
    const src = readFileSync(new URL('../content.js', import.meta.url), 'utf8');
    const line = src.split('\n').find((l) => l.includes("glob('./chapters/*.md'"));
    expect(line).toBeTruthy();
    expect(line).not.toMatch(/eager/);
  });
  it('сборка ограничивает чанк 400 КБ', () => {
    const cfg = readFileSync(new URL('../../../vite.config.ts', import.meta.url), 'utf8');
    expect(cfg).toMatch(/chunkLimit\(Number\(process\.env\.CHUNK_LIMIT_KB \|\| 400\) \* 1024\)/);
  });
});
