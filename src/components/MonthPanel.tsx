import { useRef, useState } from 'react';
import type { Category, SavingsBucket, Transaction, CategoryRule } from '../types/api';
import type { RawTransaction } from '../utils/csvParser';
import { parseCSV, autoCategorize } from '../utils/csvParser';
import { formatCurrency } from '../utils/sankeyUtils';
import TransactionReviewer from './TransactionReviewer';

interface Props {
  monthId: string;
  categories: Category[];
  buckets: SavingsBucket[];
  rules: CategoryRule[];
  transactions: Transaction[];
  onImport: (txns: RawTransaction[]) => Promise<void>;
}

const DOT_COLOR: Record<string, string> = {
  income: '#10b981',
  expense: '#ef4444',
  savings: '#6366f1',
  ignored: '#475569',
};

export default function MonthPanel({ monthId, categories, buckets, rules, transactions, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [reviewing, setReviewing] = useState<RawTransaction[] | null>(null);
  const [parseError, setParseError] = useState('');

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError('');
    try {
      const text = await file.text();
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        setParseError('No transactions found — check CSV format.');
        e.target.value = '';
        return;
      }
      const withCats = autoCategorize(parsed, rules.map((r) => ({ keyword: r.keyword, category_id: r.category_id })));
      setReviewing(withCats);
    } catch {
      setParseError('Failed to parse the CSV file.');
    }
    e.target.value = '';
  }

  async function handleSubmit(txns: RawTransaction[]) {
    await onImport(txns);
    setReviewing(null);
  }

  const income = transactions.filter((t) => t.txn_type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter((t) => t.txn_type === 'expense').reduce((s, t) => s + t.amount, 0);
  const savings = transactions.filter((t) => t.txn_type === 'savings').reduce((s, t) => s + t.amount, 0);
  const net = income - expense - savings;
  const activeCount = transactions.filter((t) => t.txn_type !== 'ignored').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFile} />

      <button onClick={() => fileRef.current?.click()}
        style={{ width: '100%', background: '#6366f115', border: '1px dashed #6366f1', color: '#6366f1', borderRadius: 8, padding: '10px', fontSize: 13, cursor: 'pointer' }}>
        {transactions.length > 0 ? 'Re-import Statement' : '+ Import Bank Statement'}
      </button>

      {parseError && (
        <div style={{ fontSize: 12, color: '#ef4444', background: '#ef444415', border: '1px solid #ef444430', borderRadius: 6, padding: '6px 10px' }}>
          {parseError}
        </div>
      )}

      {transactions.length > 0 && (
        <>
          <div style={{ background: '#0f1117', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ fontSize: 11, color: '#8892b0', marginBottom: 2 }}>{activeCount} active transactions</div>
            <SummaryRow label="Income" value={income} color="#10b981" />
            <SummaryRow label="Expenses" value={expense} color="#ef4444" />
            {savings > 0 && <SummaryRow label="Savings" value={savings} color="#6366f1" />}
            <div style={{ borderTop: '1px solid #2e3355', paddingTop: 5, marginTop: 2 }}>
              <SummaryRow label="Net" value={Math.abs(net)} color={net >= 0 ? '#10b981' : '#ef4444'} prefix={net < 0 ? '-' : '+'} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 11, color: '#8892b0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Transactions</div>
            {transactions.slice(0, 40).map((t) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', opacity: t.txn_type === 'ignored' ? 0.35 : 1 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: DOT_COLOR[t.txn_type] ?? '#475569', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 11, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={t.description}>{t.description}</span>
                <span style={{ fontSize: 11, color: '#8892b0', flexShrink: 0 }}>{formatCurrency(t.amount)}</span>
              </div>
            ))}
            {transactions.length > 40 && (
              <div style={{ fontSize: 11, color: '#8892b0', textAlign: 'center', padding: '3px 0' }}>
                +{transactions.length - 40} more
              </div>
            )}
          </div>
        </>
      )}

      {transactions.length === 0 && (
        <div style={{ textAlign: 'center', color: '#8892b0', fontSize: 12, padding: '16px 0', lineHeight: 1.6 }}>
          Import a CSV bank statement to<br />track and categorize transactions.
        </div>
      )}

      {reviewing && (
        <TransactionReviewer
          initialTxns={reviewing}
          categories={categories}
          buckets={buckets}
          monthId={monthId}
          onClose={() => setReviewing(null)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

function SummaryRow({ label, value, color, prefix }: { label: string; value: number; color: string; prefix?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <span style={{ color: '#8892b0' }}>{label}</span>
      <span style={{ color, fontWeight: 600 }}>{prefix}{formatCurrency(value)}</span>
    </div>
  );
}
