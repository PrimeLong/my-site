import { describe, it, expect } from 'vitest';
import { REGION_EVENTS, REGION_EVENT_BY_ID, regionEventOwner, botPresidentRegion, publicRegionEvent, regionStep } from '../world/regions.js';

const stateWith = (id) => ({ regionEvent: { id }, regionShock: {}, regionMods: {}, projects: [], projectsBuilt: [], approval: 50, politicalTension: 40, politicalRegime: 'democracy' });

describe('кто отвечает на событие в области', () => {
  it('митинг, подполье, школы и армия на пожарах — решение президента, а не Минфина', () => {
    ['capital_rally', 'wildfire', 'nordholm_underground', 'halvik_schools'].forEach((id) => expect(regionEventOwner(id), id).toBe('president'));
  });
  it('то, что стоит денег и касается бюджета, — за правительством (Минфином)', () => {
    ['miners_strike', 'drought', 'port_accident', 'bank_panic', 'plant_closure', 'youth_exodus', 'pereval_smuggling'].forEach((id) => expect(regionEventOwner(id), id).toBe('government'));
    // у каждого события есть хозяин
    REGION_EVENTS.forEach((e) => expect(['president', 'government']).toContain(regionEventOwner(e.id)));
  });
  it('интерфейс знает хозяина события: «Решает президент»', () => {
    const ev = REGION_EVENT_BY_ID.capital_rally;
    expect(publicRegionEvent(ev, stateWith('capital_rally'), 5).owner).toBe('president');
    expect(publicRegionEvent(REGION_EVENT_BY_ID.drought, stateWith('drought'), 5).owner).toBe('government');
  });
  it('бот-президент отвечает по характеру; на бюджетные события не отвечает', () => {
    const s = stateWith('capital_rally');
    expect(botPresidentRegion(s, 'populist')).toBe('meet');
    expect(botPresidentRegion(s, 'reformer')).toBe('meet');
    expect(botPresidentRegion(s, 'technocrat')).toBe('allow');
    expect(botPresidentRegion(s, 'strongman')).toBe('ban');
    expect(botPresidentRegion(stateWith('drought'), 'populist')).toBe(null);
  });
  it('в новости о событии сказано, за кем решение', () => {
    const ev = REGION_EVENT_BY_ID.capital_rally;
    const res = regionStep({ ...stateWith('capital_rally'), regionEvent: publicRegionEvent(ev, stateWith('capital_rally'), 4) }, { regionResponse: 'allow' }, 'normal', 5, true);
    expect(res.lastRegionResolution.option).toBe('allow');
  });
});
