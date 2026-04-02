export interface BudgetCategory {
  id: string;
  name: string;
  targetAmount: number;
  color: string;
}

export interface SavingsBucket {
  id: string;
  name: string;
  targetAmount: number;
  color: string;
}

export interface MonthData {
  id: string; // "YYYY-MM"
  income: number;
  spending: Record<string, number>; // categoryId -> actual amount spent
  savingsContributions: Record<string, number>; // bucketId -> amount contributed this month
}

export interface AppState {
  budgetCategories: BudgetCategory[];
  savingsBuckets: SavingsBucket[];
  months: Record<string, MonthData>;
  currentMonthId: string;
}

export interface SankeyNode {
  id: string;
  label: string;
  color: string;
  value?: number;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
  color?: string;
  isOverBudget?: boolean;
}

export type SankeyData = {
  nodes: SankeyNode[];
  links: SankeyLink[];
};
