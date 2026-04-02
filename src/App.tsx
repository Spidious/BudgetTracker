import { useRef, useState, useEffect } from 'react';
import { useBudgetStore } from './store/budgetStore';
import { buildSankeyData } from './utils/sankeyUtils';
import { getCurrentMonthId } from './utils/dateUtils';
import SankeyDiagram from './components/SankeyDiagram';
import MonthNavigation from './components/MonthNavigation';
import MonthInputPanel from './components/MonthInputPanel';
import BudgetConfigPanel from './components/BudgetConfigPanel';
import SavingsBucketsPanel from './components/SavingsBucketsPanel';
import './index.css';

type Tab = 'categories' | 'savings';

export default function App() {
  const { currentMonthId, months, budgetCategories, savingsBuckets } = useBudgetStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 600, height: 400 });
  const [activeTab, setActiveTab] = useState<Tab>('categories');
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  const isHistorical = currentMonthId < getCurrentMonthId();
  const month = months[currentMonthId] || { id: currentMonthId, income: 0, spending: {}, savingsContributions: {} };
  const sankeyData = buildSankeyData(month, budgetCategories, savingsBuckets, isHistorical);

  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDims({ width: Math.max(300, width - 40), height: Math.max(200, height - 40) });
      }
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const panelStyle: React.CSSProperties = {
    background: '#1a1d2e',
    border: '1px solid #2e3355',
    borderRadius: 12,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  };

  const panelHeaderStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderBottom: '1px solid #2e3355',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: '#e2e8f0',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f1117',
      display: 'flex',
      flexDirection: 'column',
      padding: 16,
      gap: 12,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: '#1a1d2e',
        borderRadius: 12,
        border: '1px solid #2e3355',
        flexShrink: 0,
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
          }}>
            💰
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>BudgetFlow</div>
            <div style={{ fontSize: 11, color: '#8892b0' }}>Track. Visualize. Save.</div>
          </div>
        </div>

        <MonthNavigation />

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setLeftOpen((v) => !v)}
            style={{
              background: leftOpen ? '#6366f120' : 'transparent',
              border: `1px solid ${leftOpen ? '#6366f1' : '#2e3355'}`,
              color: leftOpen ? '#6366f1' : '#8892b0',
              borderRadius: 6,
              padding: '5px 10px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Budget Config
          </button>
          <button
            onClick={() => setRightOpen((v) => !v)}
            style={{
              background: rightOpen ? '#6366f120' : 'transparent',
              border: `1px solid ${rightOpen ? '#6366f1' : '#2e3355'}`,
              color: rightOpen ? '#6366f1' : '#8892b0',
              borderRadius: 6,
              padding: '5px 10px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Data Entry
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 500 }}>

        {/* Left panel: Budget config + savings */}
        {leftOpen && (
          <div style={{ ...panelStyle, width: 260, flexShrink: 0 }}>
            <div style={{ ...panelHeaderStyle, gap: 0, padding: 0 }}>
              {(['categories', 'savings'] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1,
                    padding: '12px 8px',
                    background: activeTab === tab ? '#242740' : 'transparent',
                    border: 'none',
                    borderBottom: activeTab === tab ? '2px solid #6366f1' : '2px solid transparent',
                    color: activeTab === tab ? '#e2e8f0' : '#8892b0',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {tab === 'categories' ? 'Budget' : 'Savings'}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 12 }} className="scrollbar-thin">
              {activeTab === 'categories' ? <BudgetConfigPanel /> : <SavingsBucketsPanel />}
            </div>
          </div>
        )}

        {/* Center: Sankey diagram */}
        <div style={{ ...panelStyle, flex: 1, minWidth: 0 }}>
          <div style={panelHeaderStyle}>
            <span style={sectionTitleStyle}>
              {isHistorical ? 'Actual Spending' : 'Budget Flow'}
            </span>
            {isHistorical ? (
              <span style={{ fontSize: 11, color: '#8892b0' }}>Actuals — targets shown as variance</span>
            ) : (
              <span style={{ fontSize: 11, color: '#8892b0' }}>
                {month.income > 0 ? 'Showing actual flow' : 'Enter income & spending to visualize'}
              </span>
            )}
          </div>

          <div
            ref={containerRef}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflow: 'hidden', minHeight: 300 }}
          >
            <SankeyDiagram data={sankeyData} width={dims.width} height={dims.height} />
          </div>

          {/* Historical variance badges */}
          {isHistorical && month.income > 0 && (
            <div style={{ borderTop: '1px solid #2e3355', padding: '10px 16px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {budgetCategories.map((cat) => {
                const actual = month.spending[cat.id] || 0;
                if (actual === 0 && cat.targetAmount === 0) return null;
                const pct = cat.targetAmount > 0
                  ? ((actual - cat.targetAmount) / cat.targetAmount) * 100
                  : 0;
                const isOver = pct > 0;
                const isUnder = pct < 0;
                return (
                  <div key={cat.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '4px 10px',
                    borderRadius: 20,
                    background: isOver ? '#ef444415' : isUnder ? '#10b98115' : '#242740',
                    border: `1px solid ${isOver ? '#ef444430' : isUnder ? '#10b98130' : '#2e3355'}`,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: cat.color }} />
                    <span style={{ fontSize: 12, color: '#e2e8f0' }}>{cat.name}</span>
                    {cat.targetAmount > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: isOver ? '#ef4444' : '#10b981' }}>
                        {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right panel: monthly data entry */}
        {rightOpen && (
          <div style={{ ...panelStyle, width: 260, flexShrink: 0 }}>
            <div style={panelHeaderStyle}>
              <span style={sectionTitleStyle}>
                {isHistorical ? 'Recorded Data' : 'This Month'}
              </span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 12 }} className="scrollbar-thin">
              <MonthInputPanel monthId={currentMonthId} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
