import { describe, expect, it } from 'vitest';
import { getAutoScenery, isSceneryMode } from '../src/lib/scenery';

describe('isSceneryMode', () => {
  it('只接受四种风光模式', () => {
    expect(isSceneryMode('rain')).toBe(true);
    expect(isSceneryMode('twilight')).toBe(true);
    expect(isSceneryMode('mist')).toBe(true);
    expect(isSceneryMode('star')).toBe(true);
    expect(isSceneryMode('aurora')).toBe(false);
    expect(isSceneryMode(null)).toBe(false);
  });
});

describe('getAutoScenery', () => {
  it('白天为迷雾、傍晚为黄昏、夜间为雨、深夜为星', () => {
    expect(getAutoScenery(new Date('2026-09-04T10:00:00'))).toBe('mist');
    expect(getAutoScenery(new Date('2026-09-04T18:00:00'))).toBe('twilight');
    expect(getAutoScenery(new Date('2026-09-04T21:00:00'))).toBe('rain');
    expect(getAutoScenery(new Date('2026-09-04T01:00:00'))).toBe('star');
  });
});
