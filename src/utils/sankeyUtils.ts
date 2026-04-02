import type { BudgetCategory, MonthData, SavingsBucket, SankeyData } from '../types';

export function buildSankeyData(
  month: MonthData,
  categories: BudgetCategory[],
  savingsBuckets: SavingsBucket[],
  isHistorical: boolean
): SankeyData {
  const nodes: SankeyData['nodes'] = [];
  const links: SankeyData['links'] = [];

  const income = month.income || 0;
  if (income === 0) return { nodes: [], links: [] };

  // Source: Income node
  nodes.push({ id: 'income', label: 'Income', color: '#10b981' });

  // Spending categories
  for (const cat of categories) {
    const actual = month.spending[cat.id] || 0;
    if (actual <= 0 && !isHistorical) {
      // In current/future month, still show if target > 0
      if (cat.targetAmount <= 0) continue;
    }
    const amount = isHistorical ? actual : (actual > 0 ? actual : cat.targetAmount);
    if (amount <= 0) continue;

    const isOver = isHistorical && actual > cat.targetAmount && cat.targetAmount > 0;
    nodes.push({ id: `cat_${cat.id}`, label: cat.name, color: cat.color });
    links.push({
      source: 'income',
      target: `cat_${cat.id}`,
      value: amount,
      color: cat.color,
      isOverBudget: isOver,
    });
  }

  // Savings buckets
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
  }

  // Remaining / unallocated
  const totalSpent = categories.reduce((sum, cat) => {
    const val = isHistorical
      ? (month.spending[cat.id] || 0)
      : (month.spending[cat.id] || cat.targetAmount);
    return sum + (val > 0 ? val : 0);
  }, 0);

  const totalSavings = savingsBuckets.reduce(
    (sum, b) => sum + (month.savingsContributions[b.id] || 0),
    0
  );

  const remaining = income - totalSpent - totalSavings;
  if (remaining > 0) {
    nodes.push({ id: 'remaining', label: 'Remaining', color: '#475569' });
    links.push({
      source: 'income',
      target: 'remaining',
      value: remaining,
      color: '#475569',
    });
  }

  return { nodes, links };
}

export function calcVariance(actual: number, target: number): number {
  if (target === 0) return 0;
  return ((actual - target) / target) * 100;
}

export function formatVariance(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}
