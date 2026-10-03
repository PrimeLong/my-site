/* Обозначения в формулах: у каждой буквы выключной формулы главы и формулы в шаге урока есть
   пояснение; одна буква в разных главах значит своё. */
import { describe, it, expect } from 'vitest';
import { SYMBOLS, formulaSymbols, symbolsOf, unexplained } from '../symbols.js';
import { CHAPTER_BLOCKS } from '../content.js';
import { collectBlocks } from '../markdown.js';
import { pilotUnits } from '../../learn/course.js';

const mathIn = (nodes, out = []) => { (nodes || []).forEach((n) => { if (n.t === 'math') out.push(n.v); else if (n.c) mathIn(n.c, out); }); return out; };

describe('обозначения в формулах', () => {
  it('в каждой выключной формуле главы все буквы объяснены', () => {
    Object.keys(CHAPTER_BLOCKS).forEach((id) => {
      collectBlocks(CHAPTER_BLOCKS[id], (b) => b.type === 'math').forEach((m) => {
        expect(SYMBOLS[id], `${id}: нет словаря обозначений`).toBeTruthy();
        expect(unexplained(m.tex, id), `${id}: ${m.tex}`).toEqual([]);
      });
    });
  });
  it('в формулах шагов уроков Пути все буквы объяснены', () => {
    pilotUnits().forEach((u) => u.lessons.forEach((l) => l.inner.forEach((c) => mathIn(c.idea.text).forEach((t) => {
      expect(unexplained(t, u.id), `${c.idea.id}: ${t}`).toEqual([]);
    }))));
  });
  it('находит обозначения по порядку и не путает MC с C, P^* с P, kY с одной буквой', () => {
    expect(formulaSymbols('Q_D = a - bP', 'supply-demand').map((x) => x.key)).toEqual(['Q_D', 'a', 'b', 'P']);
    expect(formulaSymbols('P^* = \\frac{a - c}{b + d}', 'supply-demand').map((x) => x.key)).toEqual(['P^*', 'a', 'c', 'b', 'd']);
    expect(formulaSymbols('ATC = AFC + AVC', 'costs').map((x) => x.key)).toEqual(['ATC', 'AFC', 'AVC']);
    expect(formulaSymbols('r = \\frac{kY - M/P}{h}', 'is-lm').map((x) => x.key)).toEqual(['r', 'k', 'Y', 'M', 'P', 'h']);
    expect(formulaSymbols('Q_{D} = 100 - 2P', 'supply-demand').map((x) => x.key)).toEqual(['Q_D', 'P']);
    // одна буква — разный смысл в разных главах
    expect(formulaSymbols('Y', 'scarcity')[0].text).toMatch(/станк/);
    expect(formulaSymbols('Y', 'gdp')[0].text).toMatch(/ВВП/);
    expect(symbolsOf(['Q_D = 100 - 2P', 'Q_S = -20 + 4P'], 'supply-demand').map((x) => x.key)).toEqual(['Q_D', 'P', 'Q_S']);
    expect(formulaSymbols('x', 'нет-главы')).toEqual([]);
  });
});
