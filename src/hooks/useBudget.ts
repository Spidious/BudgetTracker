import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../api/client';
import type { Category, SavingsBucket, MonthData, Transaction, CategoryRule } from '../types/api';
import type { RawTransaction } from '../utils/csvParser';

export function useBudget() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [buckets, setBuckets] = useState<SavingsBucket[]>([]);
  const [months, setMonths] = useState<Record<string, MonthData>>({});
  const [monthTransactions, setMonthTransactions] = useState<Record<string, Transaction[]>>({});
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, bkts, r] = await Promise.all([
        api.get<Category[]>('/budget/categories'),
        api.get<SavingsBucket[]>('/budget/buckets'),
        api.get<CategoryRule[]>('/transactions/rules/all'),
      ]);
      setCategories(cats);
      setBuckets(bkts);
      setRules(r);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load budget data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  const getMonth = useCallback(async (monthId: string): Promise<MonthData> => {
    if (months[monthId]) return months[monthId];
    const data = await api.get<MonthData>(`/budget/months/${monthId}`);
    setMonths((prev) => ({ ...prev, [monthId]: data }));
    return data;
  }, [months]);

  const saveMonth = useCallback(async (monthId: string, patch: Partial<MonthData>) => {
    const updated = await api.put<MonthData>(`/budget/months/${monthId}`, patch);
    setMonths((prev) => ({ ...prev, [monthId]: updated }));
    return updated;
  }, []);

  // ── Categories ──
  const addCategory = useCallback(async (name: string, targetAmount: number, color: string) => {
    const cat = await api.post<Category>('/budget/categories', { name, targetAmount, color });
    setCategories((prev) => [...prev, cat]);
    return cat;
  }, []);

  const updateCategory = useCallback(async (id: string, updates: Partial<Pick<Category, 'name' | 'target_amount' | 'color'>>) => {
    const cat = await api.put<Category>(`/budget/categories/${id}`, updates);
    setCategories((prev) => prev.map((c) => c.id === id ? cat : c));
    return cat;
  }, []);

  const removeCategory = useCallback(async (id: string) => {
    await api.delete(`/budget/categories/${id}`);
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setMonths((prev) => {
      const next = { ...prev };
      for (const m of Object.values(next)) {
        delete m.spending[id];
      }
      return next;
    });
  }, []);

  // ── Buckets ──
  const addBucket = useCallback(async (name: string, targetAmount: number, color: string) => {
    const b = await api.post<SavingsBucket>('/budget/buckets', { name, targetAmount, color });
    setBuckets((prev) => [...prev, b]);
    return b;
  }, []);

  const updateBucket = useCallback(async (id: string, updates: Partial<Pick<SavingsBucket, 'name' | 'target_amount' | 'color'>>) => {
    const b = await api.put<SavingsBucket>(`/budget/buckets/${id}`, updates);
    setBuckets((prev) => prev.map((x) => x.id === id ? b : x));
    return b;
  }, []);

  const removeBucket = useCallback(async (id: string) => {
    await api.delete(`/budget/buckets/${id}`);
    setBuckets((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const getBucketTotal = useCallback((bucketId: string): number => {
    return Object.values(months).reduce((sum, m) => sum + (m.savingsContributions[bucketId] || 0), 0);
  }, [months]);

  // ── Transactions ──
  const loadTransactions = useCallback(async (monthId: string): Promise<Transaction[]> => {
    const txns = await api.get<Transaction[]>(`/transactions/${monthId}`);
    setMonthTransactions((prev) => ({ ...prev, [monthId]: txns }));
    return txns;
  }, []);

  const importTransactions = useCallback(async (monthId: string, txns: RawTransaction[]): Promise<Transaction[]> => {
    const saved = await api.post<Transaction[]>(`/transactions/${monthId}`, { transactions: txns });
    setMonthTransactions((prev) => ({ ...prev, [monthId]: saved }));
    return saved;
  }, []);

  const updateTransaction = useCallback(async (monthId: string, id: string, patch: Partial<Transaction>): Promise<Transaction> => {
    const updated = await api.patch<Transaction>(`/transactions/${monthId}/${id}`, patch);
    setMonthTransactions((prev) => ({
      ...prev,
      [monthId]: (prev[monthId] ?? []).map((t) => t.id === id ? updated : t),
    }));
    return updated;
  }, []);

  const deleteTransaction = useCallback(async (monthId: string, id: string): Promise<void> => {
    await api.delete(`/transactions/${monthId}/${id}`);
    setMonthTransactions((prev) => ({
      ...prev,
      [monthId]: (prev[monthId] ?? []).filter((t) => t.id !== id),
    }));
  }, []);

  const upsertRule = useCallback(async (keyword: string, categoryId: string): Promise<void> => {
    await api.put('/transactions/rules/all', { keyword, category_id: categoryId });
    setRules((prev) => {
      const idx = prev.findIndex((r) => r.keyword.toLowerCase() === keyword.toLowerCase());
      if (idx >= 0) return prev.map((r, i) => i === idx ? { ...r, category_id: categoryId } : r);
      return [...prev, { id: '', user_id: '', keyword, category_id: categoryId }];
    });
  }, []);

  return {
    categories, buckets, months, monthTransactions, rules, loading, error,
    getMonth, saveMonth,
    addCategory, updateCategory, removeCategory,
    addBucket, updateBucket, removeBucket, getBucketTotal,
    loadTransactions, importTransactions, updateTransaction, deleteTransaction,
    upsertRule,
    reload: loadInitial,
  };
}
