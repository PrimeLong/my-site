import { describe, it, expect } from 'vitest';
import { pruneResumes, RESUME_MS } from '../resume.js';

describe('незаконченный урок', () => {
  const now = 1_800_000_000_000;
  it('в течение суток урок можно продолжить, позже — он брошен', () => {
    const { fresh, expired } = pruneResumes({
      a: { at: now - 1000, pos: 2 },
      b: { at: now - RESUME_MS - 1, pos: 5, kind: 'calc' },
    }, now);
    expect(Object.keys(fresh)).toEqual(['a']);
    expect(expired).toEqual([{ id: 'b', at: now - RESUME_MS - 1, pos: 5, kind: 'calc' }]);
  });
  it('запись без времени или «из будущего» (сбитые часы) не продолжается', () => {
    const { fresh, expired } = pruneResumes({ a: { pos: 1 }, b: { at: now + 3600_000 } }, now);
    expect(fresh).toEqual({});
    expect(expired.map((r) => r.id)).toEqual(['a', 'b']);
  });
  it('пустое хранилище — ничего', () => {
    expect(pruneResumes(null, now)).toEqual({ fresh: {}, expired: [] });
  });
});
