import { useState, useMemo, useCallback } from 'react';
import type { Category, SavingsBucket } from '../types/api';
import type { RawTransaction } from '../utils/csvParser';
import { detectTransferPairs } from '../utils/csvParser';
import { formatCurrency } from '../utils/sankeyUtils';
import PieChart from './PieChart';
import type { PieSlice } from './PieChart';

type TxnType = 'income' | 'expense' | 'savings' | 'ignored';

const TYPE_COLOR: Record<TxnType, string> = {
  income: '#10b981',
  expense: '#ef4444',
  savings: '#6366f1',
  ignored: '#475569',
};

interface Props {
  initialTxns: RawTransaction[];
  categories: Category[];
  buckets: SavingsBucket[];
  monthId: string;
  onClose: () => void;
  onSubmit: (txns: RawTransaction[]) => Promise<void>;
}

export default function TransactionReviewer({ initialTxns, categories, buckets, monthId, onClose, onSubmit }: Props) {
  const [txns, setTxns] = useState<RawTransaction[]>(() => initialTxns.map((t) => ({ ...t })));
  const [submitting, setSubmitting] = useState(false);

  const transferPairs = useMemo(() => {
    const incomeExpense = txns.filter(
      (t): t is RawTransaction & { txn_type: 'income' | 'expense' } =>
        t.txn_type === 'income' || t.txn_type === 'expense'
    );
    return detectTransferPairs(incomeExpense);
  }, [txns]);

  const update = useCallback((id: string, patch: Partial<RawTransaction>) => {
    setTxns((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const remove = useCallback((id: string) => {
    setTxns((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const ignorePair = useCallback((txnIds: string[]) => {
    const ids = new Set(txnIds);
    setTxns((prev) => prev.map((t) => ids.has(t.id) ? { ...t, txn_type: 'ignored' as TxnType } : t));
  }, []);

  const activeTxns = useMemo(() => txns.filter((t) => t.txn_type !== 'ignored'), [txns]);

  const stats = useMemo(() => {
    const income = activeTxns.filter((t) => t.txn_type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = activeTxns.filter((t) => t.txn_type === 'expense').reduce((s, t) => s + t.amount, 0);
    const savings = activeTxns.filter((t) => t.txn_type === 'savings').reduce((s, t) => s + t.amount, 0);
    return { income, expense, savings };
  }, [activeTxns]);

  const pieData = useMemo((): PieSlice[] => {
    const catMap = new Map(categories.map((c) => [c.id, c]));
    const bySeg: Map<string, { color: string; value: number }> = new Map();
    let uncat = 0;

    for (const t of activeTxns.filter((t) => t.txn_type === 'expense')) {
      if (t.category_id && catMap.has(t.category_id)) {
        const c = catMap.get(t.category_id)!;
        const cur = bySeg.get(c.name);
        bySeg.set(c.name, { color: c.color, value: (cur?.value ?? 0) + t.amount });
      } else {
        uncat += t.amount;
      }
    }

    const slices: PieSlice[] = Array.from(bySeg.entries()).map(([label, { color, value }]) => ({ label, value, color }));
    if (uncat > 0) slices.push({ label: 'Uncat.', value: uncat, color: '#475569' });
    return slices;
  }, [activeTxns, categories]);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onSubmit(txns);
    } finally {
      setSubmitting(false);
    }
  }

  const sel: React.CSSProperties = {
    background: '#0f1117', border: '1px solid #2e3355', color: '#e2e8f0',
    borderRadius: 4, padding: '3px 6px', fontSize: 12, outline: 'none', cursor: 'pointer', maxWidth: '100%',
  };

  const net = stats.income - stats.expense - stats.savings;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000cc', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#1a1d2e', border: '1px solid #2e3355', borderRadius: 16, width: '100%', maxWidth: 1100, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #2e3355', flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0' }}>Review Transactions — {monthId}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8892b0', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Left: table */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid #2e3355' }}>

            {/* Transfer pair warnings */}
            {transferPairs.length > 0 && (
              <div style={{ padding: '8px 14px', background: '#f59e0b0d', borderBottom: '1px solid #f59e0b25', flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, marginBottom: 5 }}>
                  {transferPairs.length} potential transfer pair{transferPairs.length !== 1 ? 's' : ''} detected
                </div>
                {transferPairs.map((g) => (
                  <div key={g.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: '#8892b0', flex: 1 }}>
                      "{g.key}" — {g.transactions.length} txns, net {formatCurrency(g.netAmount)}
                    </span>
                    <button onClick={() => ignorePair(g.transactions.map((t) => t.id))}
                      style={{ background: '#f59e0b15', border: '1px solid #f59e0b35', color: '#f59e0b', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>
                      Ignore All
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Table header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '68px 1fr 76px 110px 140px 26px',
              gap: 6, padding: '6px 12px', background: '#242740', borderBottom: '1px solid #2e3355',
              fontSize: 11, color: '#8892b0', fontWeight: 600, flexShrink: 0,
            }}>
              <span>Date</span><span>Description</span>
              <span style={{ textAlign: 'right' }}>Amount</span>
              <span>Type</span><span>Category / Bucket</span><span />
            </div>

            {/* Rows */}
            <div style={{ flex: 1, overflowY: 'auto' }} className="scrollbar-thin">
              {txns.map((t) => {
                const ignored = t.txn_type === 'ignored';
                return (
                  <div key={t.id} style={{
                    display: 'grid', gridTemplateColumns: '68px 1fr 76px 110px 140px 26px',
                    gap: 6, padding: '4px 12px', borderBottom: '1px solid #0f111720',
                    alignItems: 'center', opacity: ignored ? 0.38 : 1,
                  }}>
                    <span style={{ fontSize: 11, color: '#8892b0' }}>{t.date || '—'}</span>
                    <span style={{ fontSize: 12, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={t.description}>{t.description}</span>
                    <span style={{ fontSize: 12, textAlign: 'right', color: TYPE_COLOR[t.txn_type as TxnType] ?? '#e2e8f0', fontWeight: 500 }}>
                      {formatCurrency(t.amount)}
                    </span>

                    <select style={sel} value={t.txn_type}
                      onChange={(e) => {
                        const newType = e.target.value as TxnType;
                        update(t.id, {
                          txn_type: newType,
                          category_id: newType === 'expense' ? t.category_id : null,
                          bucket_id: newType === 'savings' ? t.bucket_id : null,
                        });
                      }}>
                      <option value="income">Income</option>
                      <option value="expense">Expense</option>
                      <option value="savings">Savings</option>
                      <option value="ignored">Ignore</option>
                    </select>

                    {t.txn_type === 'expense' ? (
                      <select style={sel} value={t.category_id ?? ''}
                        onChange={(e) => update(t.id, { category_id: e.target.value || null })}>
                        <option value="">Uncategorized</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    ) : t.txn_type === 'savings' ? (
                      <select style={sel} value={t.bucket_id ?? ''}
                        onChange={(e) => update(t.id, { bucket_id: e.target.value || null })}>
                        <option value="">No bucket</option>
                        {buckets.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    ) : <span />}

                    <button onClick={() => remove(t.id)}
                      style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}>
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: chart + stats */}
          <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 16px', gap: 12, overflowY: 'auto' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#8892b0', textTransform: 'uppercase', letterSpacing: '0.05em', alignSelf: 'flex-start' }}>Breakdown</div>

            <PieChart data={pieData} size={150} />

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {pieData.map((s) => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, color: '#8892b0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
                  <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{formatCurrency(s.value)}</span>
                </div>
              ))}
            </div>

            <div style={{ width: '100%', borderTop: '1px solid #2e3355', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <StatRow label="Income" value={stats.income} color="#10b981" />
              <StatRow label="Expenses" value={stats.expense} color="#ef4444" />
              {stats.savings > 0 && <StatRow label="Savings" value={stats.savings} color="#6366f1" />}
              <div style={{ borderTop: '1px solid #2e3355', paddingTop: 5, marginTop: 2 }}>
                <StatRow label="Net" value={Math.abs(net)} color={net >= 0 ? '#10b981' : '#ef4444'} prefix={net >= 0 ? '+' : '-'} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 20px', borderTop: '1px solid #2e3355', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: '#8892b0' }}>{txns.length} rows ({activeTxns.length} active)</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose}
              style={{ background: 'transparent', border: '1px solid #2e3355', color: '#8892b0', borderRadius: 8, padding: '8px 18px', fontSize: 13, cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={submitting || txns.length === 0}
              style={{ background: '#6366f1', border: 'none', color: '#fff', borderRadius: 8, padding: '8px 18px', fontSize: 13, cursor: submitting ? 'wait' : 'pointer', opacity: txns.length === 0 ? 0.5 : 1 }}>
              {submitting ? 'Saving…' : `Import ${txns.length} transactions`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, color, prefix }: { label: string; value: number; color: string; prefix?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <span style={{ color: '#8892b0' }}>{label}</span>
      <span style={{ color, fontWeight: 600 }}>{prefix}{formatCurrency(value)}</span>
    </div>
  );
}
