import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState, BudgetCategory, SavingsBucket, MonthData } from '../types';
import { formatMonthId, getCurrentMonthId } from '../utils/dateUtils';

interface BudgetStore extends AppState {
  // Navigation
  setCurrentMonth: (monthId: string) => void;
  navigateMonth: (direction: 1 | -1) => void;

  // Budget categories
  addCategory: (name: string, targetAmount: number, color: string) => void;
  updateCategory: (id: string, updates: Partial<Omit<BudgetCategory, 'id'>>) => void;
  removeCategory: (id: string) => void;

  // Savings buckets
  addSavingsBucket: (name: string, targetAmount: number, color: string) => void;
  updateSavingsBucket: (id: string, updates: Partial<Omit<SavingsBucket, 'id'>>) => void;
  removeSavingsBucket: (id: string) => void;

  // Monthly data
  setIncome: (monthId: string, amount: number) => void;
  setSpending: (monthId: string, categoryId: string, amount: number) => void;
  setSavingsContribution: (monthId: string, bucketId: string, amount: number) => void;
  getOrCreateMonth: (monthId: string) => MonthData;

  // Computed
  getSavingsBucketTotal: (bucketId: string) => number;
  isHistorical: (monthId: string) => boolean;
}

const DEFAULT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#10b981', '#06b6d4',
  '#3b82f6', '#a855f7',
];

let colorIndex = 0;
function nextColor(): string {
  return DEFAULT_COLORS[colorIndex++ % DEFAULT_COLORS.length];
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

const initialCategories: BudgetCategory[] = [
  { id: generateId(), name: 'Housing', targetAmount: 1500, color: '#6366f1' },
  { id: generateId(), name: 'Food', targetAmount: 600, color: '#10b981' },
  { id: generateId(), name: 'Transport', targetAmount: 300, color: '#f97316' },
  { id: generateId(), name: 'Utilities', targetAmount: 200, color: '#06b6d4' },
  { id: generateId(), name: 'Hobbies', targetAmount: 250, color: '#ec4899' },
  { id: generateId(), name: 'Other', targetAmount: 150, color: '#eab308' },
];

colorIndex = initialCategories.length;

export const useBudgetStore = create<BudgetStore>()(
  persist(
    (set, get) => ({
      budgetCategories: initialCategories,
      savingsBuckets: [],
      months: {},
      currentMonthId: getCurrentMonthId(),

      setCurrentMonth: (monthId) => set({ currentMonthId: monthId }),

      navigateMonth: (direction) => {
        const { currentMonthId } = get();
        const [year, month] = currentMonthId.split('-').map(Number);
        const date = new Date(year, month - 1 + direction, 1);
        set({ currentMonthId: formatMonthId(date) });
      },

      addCategory: (name, targetAmount, color) => {
        const category: BudgetCategory = { id: generateId(), name, targetAmount, color: color || nextColor() };
        set((s) => ({ budgetCategories: [...s.budgetCategories, category] }));
      },

      updateCategory: (id, updates) => {
        set((s) => ({
          budgetCategories: s.budgetCategories.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        }));
      },

      removeCategory: (id) => {
        set((s) => ({ budgetCategories: s.budgetCategories.filter((c) => c.id !== id) }));
      },

      addSavingsBucket: (name, targetAmount, color) => {
        const bucket: SavingsBucket = { id: generateId(), name, targetAmount, color: color || nextColor() };
        set((s) => ({ savingsBuckets: [...s.savingsBuckets, bucket] }));
      },

      updateSavingsBucket: (id, updates) => {
        set((s) => ({
          savingsBuckets: s.savingsBuckets.map((b) =>
            b.id === id ? { ...b, ...updates } : b
          ),
        }));
      },

      removeSavingsBucket: (id) => {
        set((s) => ({ savingsBuckets: s.savingsBuckets.filter((b) => b.id !== id) }));
      },

      getOrCreateMonth: (monthId) => {
        const existing = get().months[monthId];
        if (existing) return existing;
        const newMonth: MonthData = { id: monthId, income: 0, spending: {}, savingsContributions: {} };
        set((s) => ({ months: { ...s.months, [monthId]: newMonth } }));
        return newMonth;
      },

      setIncome: (monthId, amount) => {
        const month = get().getOrCreateMonth(monthId);
        set((s) => ({ months: { ...s.months, [monthId]: { ...month, income: amount } } }));
      },

      setSpending: (monthId, categoryId, amount) => {
        const month = get().getOrCreateMonth(monthId);
        set((s) => ({
          months: {
            ...s.months,
            [monthId]: {
              ...month,
              spending: { ...month.spending, [categoryId]: amount },
            },
          },
        }));
      },

      setSavingsContribution: (monthId, bucketId, amount) => {
        const month = get().getOrCreateMonth(monthId);
        set((s) => ({
          months: {
            ...s.months,
            [monthId]: {
              ...month,
              savingsContributions: { ...month.savingsContributions, [bucketId]: amount },
            },
          },
        }));
      },

      getSavingsBucketTotal: (bucketId) => {
        const { months } = get();
        return Object.values(months).reduce((sum, month) => {
          return sum + (month.savingsContributions[bucketId] || 0);
        }, 0);
      },

      isHistorical: (monthId) => {
        const current = getCurrentMonthId();
        return monthId < current;
      },
    }),
    { name: 'budget-tracker-v1' }
  )
);
