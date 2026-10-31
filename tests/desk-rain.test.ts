import { describe, expect, it } from 'vitest';
import { advanceGlassDrops } from '../src/lib/desk-rain';

describe('玻璃水珠', () => {
  it('小水珠停留在玻璃上并逐渐积水', () => {
    const drops = [{ x: 10, y: 20, previousY: 20, radius: 1, velocity: 0 }];
    advanceGlassDrops(drops, 0.1);
    expect(drops[0]?.y).toBe(20);
    expect(drops[0]?.radius).toBeGreaterThan(1);
  });

  it('积大的水珠开始滑落并继续加速', () => {
    const drops = [{ x: 10, y: 20, previousY: 20, radius: 2.8, velocity: 0 }];
    advanceGlassDrops(drops, 0.1);
    const firstVelocity = drops[0]?.velocity ?? 0;
    expect(drops[0]?.y).toBeGreaterThan(20);
    advanceGlassDrops(drops, 0.1);
    expect(drops[0]?.velocity).toBeGreaterThan(firstVelocity);
  });

  it('相碰的水珠合并，保留水量', () => {
    const drops = [
      { x: 10, y: 20, previousY: 20, radius: 1.5, velocity: 0 },
      { x: 11, y: 20, previousY: 20, radius: 2, velocity: 0 },
    ];
    advanceGlassDrops(drops, 0);
    expect(drops).toHaveLength(1);
    expect(drops[0]?.radius).toBeCloseTo(2.5);
  });

  it('滑落途中经过的小水珠会被吸收', () => {
    const drops = [
      { x: 10, y: 35, previousY: 35, radius: 2.5, velocity: 90 },
      { x: 10, y: 40, previousY: 40, radius: 1, velocity: 0 },
    ];
    advanceGlassDrops(drops, 0.1);
    expect(drops).toHaveLength(1);
    expect(drops[0]?.radius).toBeGreaterThan(2.5);
  });

  it('相隔较远的水珠分别停留', () => {
    const drops = [
      { x: 10, y: 20, previousY: 20, radius: 1, velocity: 0 },
      { x: 50, y: 20, previousY: 20, radius: 1, velocity: 0 },
    ];
    advanceGlassDrops(drops, 0.1);
    expect(drops).toHaveLength(2);
    expect(drops.map(drop => drop.y)).toEqual([20, 20]);
  });
});
