export function getCurrentMonthId(): string {
  return formatMonthId(new Date());
}

export function formatMonthId(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function parseMonthId(monthId: string): Date {
  const [year, month] = monthId.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

export function formatMonthLabel(monthId: string): string {
  const date = parseMonthId(monthId);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function formatShortMonth(monthId: string): string {
  const date = parseMonthId(monthId);
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}
