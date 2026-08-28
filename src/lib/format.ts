// 统一日期格式：zh-CN 长格式（如：2026 年 8 月 28 日）。
// 接受 Date 或 ISO 字符串；无效输入返回空串。

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
};

export function formatDate(input: Date | string): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.valueOf())) return '';
  return date.toLocaleDateString('zh-CN', DATE_OPTS);
}
