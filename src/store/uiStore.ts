import { create } from 'zustand';

function getCurrentMonthId(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function navigateMonth(id: string, dir: 1 | -1): string {
  const [y, m] = id.split('-').map(Number);
  const d = new Date(y, m - 1 + dir, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

interface UiStore {
  currentMonthId: string;
  leftOpen: boolean;
  rightOpen: boolean;
  activeTab: 'categories' | 'savings' | 'shares';
  setCurrentMonth: (id: string) => void;
  navigateMonth: (dir: 1 | -1) => void;
  setLeftOpen: (v: boolean) => void;
  setRightOpen: (v: boolean) => void;
  setActiveTab: (t: 'categories' | 'savings' | 'shares') => void;
}

export const useUiStore = create<UiStore>((set, get) => ({
  currentMonthId: getCurrentMonthId(),
  leftOpen: true,
  rightOpen: true,
  activeTab: 'categories',
  setCurrentMonth: (id) => set({ currentMonthId: id }),
  navigateMonth: (dir) => set({ currentMonthId: navigateMonth(get().currentMonthId, dir) }),
  setLeftOpen: (v) => set({ leftOpen: v }),
  setRightOpen: (v) => set({ rightOpen: v }),
  setActiveTab: (t) => set({ activeTab: t }),
}));

export { getCurrentMonthId };
