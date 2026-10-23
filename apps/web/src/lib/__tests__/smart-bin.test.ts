import { describe, expect, it } from 'vitest';
import { emptied, simBinState, START, type SimBin } from '../smart-bin';

const bin = (over: Partial<SimBin>): SimBin => ({ ...START, ...over });

describe('simBinState', () => {
  it('starts fine', () => expect(simBinState(START)).toBe('ok'));
  it('is full from 80 percent', () => {
    expect(simBinState(bin({ fillPct: 80 }))).toBe('full');
    expect(simBinState(bin({ fillPct: 79 }))).toBe('ok');
  });
  it('is hot from 60 degrees', () => {
    expect(simBinState(bin({ tempC: 60 }))).toBe('hot');
    expect(simBinState(bin({ tempC: 59 }))).toBe('ok');
  });
  it('shows a weak battery', () => expect(simBinState(bin({ lowBattery: true }))).toBe('low_battery'));
  it('ranks offline > full > hot > low battery', () => {
    const all = bin({ fillPct: 90, tempC: 65, lowBattery: true });
    expect(simBinState(all)).toBe('full');
    expect(simBinState({ ...all, online: false })).toBe('offline');
    expect(simBinState({ ...all, fillPct: 10 })).toBe('hot');
    expect(simBinState({ ...all, fillPct: 10, tempC: 30 })).toBe('low_battery');
  });
  it('clamps out-of-range fill', () => {
    expect(simBinState(bin({ fillPct: 150 }))).toBe('full');
    expect(simBinState(bin({ fillPct: -5 }))).toBe('ok');
  });
});

describe('emptied', () => {
  it('sets the fill to zero and keeps the rest', () => {
    const b = bin({ fillPct: 90, lowBattery: true });
    expect(emptied(b)).toEqual({ ...b, fillPct: 0 });
  });
});
