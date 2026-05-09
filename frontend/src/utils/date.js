export function parseUTCDate(dateStr) {
  if (!dateStr) return null;
  if (typeof dateStr === 'string' && !dateStr.match(/[Zz]|[+-]\d{2}:?\d{2}$/)) {
    return new Date(dateStr + 'Z');
  }
  return new Date(dateStr);
}

export function formatRelativeTime(dateStr) {
  const d = parseUTCDate(dateStr);
  if (!d) return '';
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffDay = Math.floor(diffMs / 86400000);
  const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffDay === 0) return `今天 ${timeStr}`;
  if (diffDay === 1) return `昨天 ${timeStr}`;
  if (diffDay < 7) return `${diffDay} 天前`;
  if (d.getFullYear() === now.getFullYear()) return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${timeStr}`;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${timeStr}`;
}

export function formatFullDateTime(dateStr) {
  const d = parseUTCDate(dateStr);
  if (!d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}