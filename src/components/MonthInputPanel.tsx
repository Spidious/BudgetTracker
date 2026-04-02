import { useBudgetStore } from '../store/budgetStore';
import { calcVariance, formatVariance, formatCurrency } from '../utils/sankeyUtils';
import { getCurrentMonthId } from '../utils/dateUtils';

interface Props {
  monthId: string;
}

export default function MonthInputPanel({ monthId }: Props) {
  const {
    budgetCategories,
    savingsBuckets,
    months,
    setIncome,
    setSpending,
    setSavingsContribution,
    getOrCreateMonth,
  } = useBudgetStore();

  const month = months[monthId] || { id: monthId, income: 0, spending: {}, savingsContributions: {} };
  const isHistorical = monthId < getCurrentMonthId();

  const totalSpending = budgetCategories.reduce(
    (sum, cat) => sum + (month.spending[cat.id] || 0),
    0
  );
  const totalSavings = savingsBuckets.reduce(
    (sum, b) => sum + (month.savingsContributions[b.id] || 0),
    0
  );
  const remaining = month.income - totalSpending - totalSavings;

  const inputStyle = {
    background: '#0f1117',
    border: '1px solid #2e3355',
    color: '#e2e8f0',
    borderRadius: 6,
    padding: '6px 10px',
    fontSize: 13,
    width: '100%',
    outline: 'none',
  };

  const labelStyle = {
    fontSize: 12,
    color: '#8892b0',
    marginBottom: 4,
    display: 'block' as const,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Income */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
          Income
        </div>
        <div>
          <label style={labelStyle}>Monthly Income</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#8892b0', fontSize: 13 }}>$</span>
            <input
              type="number"
              min={0}
              value={month.income || ''}
              onChange={(e) => {
                getOrCreateMonth(monthId);
                setIncome(monthId, parseFloat(e.target.value) || 0);
              }}
              placeholder="0"
              style={{ ...inputStyle, paddingLeft: 22 }}
            />
          </div>
        </div>
      </div>

      {/* Spending by category */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
          Spending
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {budgetCategories.map((cat) => {
            const actual = month.spending[cat.id] || 0;
            const variance = isHistorical && cat.targetAmount > 0
              ? calcVariance(actual, cat.targetAmount)
              : null;

            return (
              <div key={cat.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ ...labelStyle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, display: 'inline-block', flexShrink: 0 }} />
                    {cat.name}
                  </label>
                  {isHistorical && variance !== null ? (
                    <span style={{
                      fontSize: 11,
                      color: variance > 0 ? '#ef4444' : '#10b981',
                      fontWeight: 600,
                    }}>
                      {formatVariance(variance)}
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: '#8892b0' }}>
                      target: {formatCurrency(cat.targetAmount)}
                    </span>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#8892b0', fontSize: 13 }}>$</span>
                  <input
                    type="number"
                    min={0}
                    value={actual || ''}
                    onChange={(e) => {
                      getOrCreateMonth(monthId);
                      setSpending(monthId, cat.id, parseFloat(e.target.value) || 0);
                    }}
                    placeholder={String(cat.targetAmount)}
                    style={{ ...inputStyle, paddingLeft: 22 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Savings contributions */}
      {savingsBuckets.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
            Savings
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {savingsBuckets.map((bucket) => {
              const contrib = month.savingsContributions[bucket.id] || 0;
              return (
                <div key={bucket.id}>
                  <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: bucket.color, display: 'inline-block', flexShrink: 0 }} />
                    {bucket.name}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#8892b0', fontSize: 13 }}>$</span>
                    <input
                      type="number"
                      min={0}
                      value={contrib || ''}
                      onChange={(e) => {
                        getOrCreateMonth(monthId);
                        setSavingsContribution(monthId, bucket.id, parseFloat(e.target.value) || 0);
                      }}
                      placeholder="0"
                      style={{ ...inputStyle, paddingLeft: 22 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary */}
      {month.income > 0 && (
        <div style={{ borderTop: '1px solid #2e3355', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8892b0' }}>
            <span>Total Spending</span>
            <span style={{ color: '#e2e8f0' }}>{formatCurrency(totalSpending)}</span>
          </div>
          {totalSavings > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8892b0' }}>
              <span>Total Savings</span>
              <span style={{ color: '#e2e8f0' }}>{formatCurrency(totalSavings)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
            <span style={{ color: '#8892b0' }}>Remaining</span>
            <span style={{ color: remaining >= 0 ? '#10b981' : '#ef4444' }}>
              {formatCurrency(remaining)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
