import { describe, expect, it } from 'vitest';
import { formatDate } from '../src/lib/format';

describe('formatDate', () => {
  it('格式化 Date 对象为中文长格式（包含年份和日）', () => {
    const out = formatDate(new Date('2026-08-28T00:00:00Z'));
    expect(out).toMatch(/2026/);
    expect(out).toMatch(/28/);
  });

  it('接受 ISO 字符串输入', () => {
    expect(formatDate('2026-01-15')).toMatch(/2026/);
  });

  it('无效输入返回空串而不是抛错或显示 Invalid Date', () => {
    expect(formatDate('not a date')).toBe('');
    expect(formatDate(new Date('garbage'))).toBe('');
  });
});
