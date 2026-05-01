import type { SankeyData } from '../types';

export interface CategoryLike {
  id: string;
  name: string;
  target_amount: number;
  color: string;
}

export interface BucketLike {
  id: string;
  name: string;
  target_amount: number;
  color: string;
}

export interface MonthLike {
  income: number;
  spending: Record<string, number>;
  savingsContributions: Record<string, number>;
}

export function buildSankeyData(
  month: MonthLike,
  categories: CategoryLike[],
  savingsBuckets: BucketLike[],
  isHistorical: boolean
): SankeyData {
  const nodes: SankeyData['nodes'] = [];
  const links: SankeyData['links'] = [];

  const income = month.income || 0;
  if (income === 0) return { nodes: [], links: [] };

  nodes.push({ id: 'income', label: 'Income', color: '#10b981' });

  let totalAllocated = 0;

  for (const cat of categories) {
    const actual = month.spending[cat.id] || 0;
    if (actual <= 0) continue;

    const isOver = isHistorical && cat.target_amount > 0 && actual > cat.target_amount;
    nodes.push({ id: `cat_${cat.id}`, label: cat.name, color: cat.color });
    links.push({
      source: 'income',
      target: `cat_${cat.id}`,
      value: actual,
      color: cat.color,
      isOverBudget: isOver,
    });
    totalAllocated += actual;
  }

  for (const bucket of savingsBuckets) {
    const contribution = month.savingsContributions[bucket.id] || 0;
    if (contribution <= 0) continue;

    nodes.push({ id: `bucket_${bucket.id}`, label: bucket.name, color: bucket.color });
    links.push({
      source: 'income',
      target: `bucket_${bucket.id}`,
      value: contribution,
      color: bucket.color,
    });
    totalAllocated += contribution;
  }

  const remaining = income - totalAllocated;
  if (remaining > 0) {
    nodes.push({ id: 'remaining', label: 'Remaining', color: '#475569' });
    links.push({ source: 'income', target: 'remaining', value: remaining, color: '#475569' });
  }

  return { nodes, links };
}

export function calcVariance(actual: number, target: number): number {
  if (target === 0) return 0;
  return ((actual - target) / target) * 100;
}

export function formatVariance(pct: number): string {
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

export function formatMonthLabel(monthId: string): string {
  const [y, m] = monthId.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
