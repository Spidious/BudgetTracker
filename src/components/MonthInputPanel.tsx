import { useEffect, useState } from 'react';
import type { Category, SavingsBucket, MonthData } from '../types/api';
import { formatVariance, formatCurrency } from '../utils/sankeyUtils';
import { getCurrentMonthId } from '../store/uiStore';

interface Props {
  monthId: string;
  categories: Category[];
  buckets: SavingsBucket[];
  getMonth: (id: string) => Promise<MonthData>;
  saveMonth: (id: string, patch: Partial<MonthData>) => Promise<MonthData>;
}

export default function MonthInputPanel({ monthId, categories, buckets, getMonth, saveMonth }: Props) {
  const [month, setMonth] = useState<MonthData>({ monthId, income: 0, spending: {}, savingsContributions: {} });
  const [loaded, setLoaded] = useState(false);
  const isHistorical = monthId < getCurrentMonthId();

  useEffect(() => {
    setLoaded(false);
    getMonth(monthId).then((m) => { setMonth(m); setLoaded(true); });
  }, [monthId, getMonth]);

  async function setIncome(val: number) {
    const updated = await saveMonth(monthId, { income: val });
    setMonth(updated);
  }

  async function setSpending(catId: string, val: number) {
    const updated = await saveMonth(monthId, { spending: { ...month.spending, [catId]: val } });
    setMonth(updated);
  }

  async function setSavings(bucketId: string, val: number) {
    const updated = await saveMonth(monthId, { savingsContributions: { ...month.savingsContributions, [bucketId]: val } });
    setMonth(updated);
  }

  const totalSpend = categories.reduce((s, c) => s + (month.spending[c.id] || 0), 0);
  const totalSavings = buckets.reduce((s, b) => s + (month.savingsContributions[b.id] || 0), 0);
  const remaining = month.income - totalSpend - totalSavings;

  const inp: React.CSSProperties = { background: '#0f1117', border: '1px solid #2e3355', color: '#e2e8f0', borderRadius: 6, padding: '6px 10px', fontSize: 13, width: '100%', outline: 'none' };
  const lbl: React.CSSProperties = { fontSize: 12, color: '#8892b0', marginBottom: 4, display: 'block' };
  const section: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' };

  if (!loaded) return <div style={{ color: '#8892b0', fontSize: 13, textAlign: 'center', padding: 20 }}>Loading…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Income */}
      <div>
        <div style={section}>Income</div>
        <label style={lbl}>Monthly Income</label>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#8892b0', fontSize: 13 }}>$</span>
          <input type="number" min={0} style={{ ...inp, paddingLeft: 22 }}
            value={month.income || ''} placeholder="0"
            onChange={(e) => setIncome(parseFloat(e.target.value) || 0)} />
        </div>
      </div>

      {/* Spending */}
      <div>
        <div style={section}>Spending</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {categories.map((cat) => {
            const actual = month.spending[cat.id] || 0;
            const variance = isHistorical && cat.target_amount > 0 ? ((actual - cat.target_amount) / cat.target_amount) * 100 : null;
            return (
              <div key={cat.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ ...lbl, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, display: 'inline-block' }} />
                    {cat.name}
                  </label>
                  {isHistorical && variance !== null ? (
                    <span style={{ fontSize: 11, color: variance > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                      {formatVariance(variance)}
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: '#8892b0' }}>target: {formatCurrency(cat.target_amount)}</span>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#8892b0', fontSize: 13 }}>$</span>
                  <input type="number" min={0} style={{ ...inp, paddingLeft: 22 }}
                    value={actual || ''} placeholder={String(cat.target_amount)}
                    onChange={(e) => setSpending(cat.id, parseFloat(e.target.value) || 0)} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Savings */}
      {buckets.length > 0 && (
        <div>
          <div style={section}>Savings</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {buckets.map((b) => (
              <div key={b.id}>
                <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: b.color, display: 'inline-block' }} />
                  {b.name}
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#8892b0', fontSize: 13 }}>$</span>
                  <input type="number" min={0} style={{ ...inp, paddingLeft: 22 }}
                    value={month.savingsContributions[b.id] || ''} placeholder="0"
                    onChange={(e) => setSavings(b.id, parseFloat(e.target.value) || 0)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      {month.income > 0 && (
        <div style={{ borderTop: '1px solid #2e3355', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8892b0' }}>
            <span>Spending</span><span style={{ color: '#e2e8f0' }}>{formatCurrency(totalSpend)}</span>
          </div>
          {totalSavings > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8892b0' }}>
              <span>Savings</span><span style={{ color: '#e2e8f0' }}>{formatCurrency(totalSavings)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
            <span style={{ color: '#8892b0' }}>Remaining</span>
            <span style={{ color: remaining >= 0 ? '#10b981' : '#ef4444' }}>{formatCurrency(remaining)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
