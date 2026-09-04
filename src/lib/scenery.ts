export const SCENERY_MODES = ['rain', 'twilight', 'mist', 'star'] as const;
export type SceneryMode = (typeof SCENERY_MODES)[number];
export const SCENERY_STORAGE_KEY = 'preferred-scenery';

export function isSceneryMode(value: string | null | undefined): value is SceneryMode {
  return value === 'rain' || value === 'twilight' || value === 'mist' || value === 'star';
}

export function getAutoScenery(now = new Date()): SceneryMode {
  const hour = now.getHours();
  if (hour >= 6 && hour < 17) return 'mist';
  if (hour >= 17 && hour < 20) return 'twilight';
  if (hour >= 20 && hour < 23) return 'rain';
  return 'star';
}

export function resolveScenery(): SceneryMode {
  try {
    const saved = localStorage.getItem(SCENERY_STORAGE_KEY);
    if (isSceneryMode(saved)) return saved;
  } catch {
    // 无痕模式或禁用存储时回退到按时段
  }
  return getAutoScenery();
}

export function applyScenery(mode: SceneryMode): void {
  document.documentElement.setAttribute('data-scenery', mode);
  window.dispatchEvent(new CustomEvent<SceneryMode>('scenery-change', { detail: mode }));
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
