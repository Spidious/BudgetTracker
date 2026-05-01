import { useRef, useState, useEffect, useCallback } from 'react';
import { useAuthStore } from './store/authStore';
import { useUiStore, getCurrentMonthId } from './store/uiStore';
import { useBudget } from './hooks/useBudget';
import { api } from './api/client';
import { buildSankeyData } from './utils/sankeyUtils';
import { formatVariance, formatCurrency } from './utils/sankeyUtils';
import type { User, Transaction, MonthData } from './types/api';
import type { RawTransaction } from './utils/csvParser';

import LoginPage from './components/LoginPage';
import ChangePasswordModal from './components/ChangePasswordModal';
import SankeyDiagram from './components/SankeyDiagram';
import MonthNavigation from './components/MonthNavigation';
import BudgetConfigPanel from './components/BudgetConfigPanel';
import SavingsBucketsPanel from './components/SavingsBucketsPanel';
import MonthPanel from './components/MonthPanel';
import SharesPanel from './components/SharesPanel';
import AdminPanel from './components/AdminPanel';
import SharedBudgetView from './components/SharedBudgetView';
import './index.css';

type LeftTab = 'categories' | 'savings' | 'shares';

function computeMonthTotals(transactions: Transaction[]): Partial<MonthData> {
  const income = transactions.filter((t) => t.txn_type === 'income').reduce((s, t) => s + t.amount, 0);
  const spending: Record<string, number> = {};
  for (const t of transactions.filter((t) => t.txn_type === 'expense' && t.category_id)) {
    spending[t.category_id!] = (spending[t.category_id!] || 0) + t.amount;
  }
  const savingsContributions: Record<string, number> = {};
  for (const t of transactions.filter((t) => t.txn_type === 'savings' && t.bucket_id)) {
    savingsContributions[t.bucket_id!] = (savingsContributions[t.bucket_id!] || 0) + t.amount;
  }
  return { income, spending, savingsContributions };
}

export default function App() {
  const { user, loading, setUser, setLoading } = useAuthStore();
  const { currentMonthId, leftOpen, rightOpen, activeTab, setLeftOpen, setRightOpen, setActiveTab } = useUiStore();
  const budget = useBudget();

  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 600, height: 400 });
  const [showAdmin, setShowAdmin] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [viewingShare, setViewingShare] = useState<{ shareId: string; ownerUsername: string } | null>(null);

  // Auth check on mount
  useEffect(() => {
    api.get<User>('/auth/me')
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // Load transactions + month data when month changes
  useEffect(() => {
    if (!user) return;
    budget.loadTransactions(currentMonthId);
    budget.getMonth(currentMonthId);
  }, [currentMonthId, user]);

  // Resize observer for Sankey container
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

  const handleImport = useCallback(async (txns: RawTransaction[]) => {
    const saved = await budget.importTransactions(currentMonthId, txns);
    const totals = computeMonthTotals(saved);
    await budget.saveMonth(currentMonthId, totals);
  }, [currentMonthId, budget]);

  async function handleLogout() {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    setUser(null);
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8892b0', fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  if (!user) return <LoginPage />;

  const isHistorical = currentMonthId < getCurrentMonthId();
  const month = budget.months[currentMonthId] ?? { monthId: currentMonthId, income: 0, spending: {}, savingsContributions: {} };
  const currentTxns = budget.monthTransactions[currentMonthId] ?? [];
  const sankeyData = buildSankeyData(month, budget.categories, budget.buckets, isHistorical);

  const panelStyle: React.CSSProperties = {
    background: '#1a1d2e', border: '1px solid #2e3355', borderRadius: 12,
    overflow: 'hidden', display: 'flex', flexDirection: 'column',
  };
  const panelHeader: React.CSSProperties = {
    padding: '10px 14px', borderBottom: '1px solid #2e3355',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
  };
  const sectionTitle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.06em',
  };
  const headerBtn = (active: boolean): React.CSSProperties => ({
    background: active ? '#6366f120' : 'transparent',
    border: `1px solid ${active ? '#6366f1' : '#2e3355'}`,
    color: active ? '#6366f1' : '#8892b0',
    borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer',
  });

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', flexDirection: 'column', padding: 12, gap: 10 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: '#1a1d2e', borderRadius: 12, border: '1px solid #2e3355', flexShrink: 0, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>💰</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>BudgetFlow</div>
            <div style={{ fontSize: 10, color: '#8892b0' }}>Track. Visualize. Save.</div>
          </div>
        </div>

        <MonthNavigation />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setLeftOpen(!leftOpen)} style={headerBtn(leftOpen)}>Config</button>
          <button onClick={() => setRightOpen(!rightOpen)} style={headerBtn(rightOpen)}>Transactions</button>
          {user.isAdmin && (
            <button onClick={() => setShowAdmin(true)} style={headerBtn(false)}>Admin</button>
          )}
          <button onClick={() => setShowChangePassword(true)} style={headerBtn(false)}>Password</button>
          <button onClick={handleLogout} style={{ ...headerBtn(false), color: '#ef4444', borderColor: '#ef444430' }}>Logout</button>
          <span style={{ fontSize: 12, color: '#8892b0', paddingLeft: 4 }}>{user.username}</span>
        </div>
      </div>

      {/* Main layout */}
      <div style={{ display: 'flex', gap: 10, flex: 1, minHeight: 500 }}>

        {/* Left panel */}
        {leftOpen && (
          <div style={{ ...panelStyle, width: 250, flexShrink: 0 }}>
            <div style={{ ...panelHeader, padding: 0, gap: 0 }}>
              {(['categories', 'savings', 'shares'] as LeftTab[]).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1, padding: '10px 6px', background: activeTab === tab ? '#242740' : 'transparent',
                    border: 'none', borderBottom: activeTab === tab ? '2px solid #6366f1' : '2px solid transparent',
                    color: activeTab === tab ? '#e2e8f0' : '#8892b0',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                  {tab === 'categories' ? 'Budget' : tab === 'savings' ? 'Savings' : 'Shares'}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 12 }} className="scrollbar-thin">
              {activeTab === 'categories' && (
                <BudgetConfigPanel
                  categories={budget.categories}
                  onAdd={budget.addCategory}
                  onUpdate={budget.updateCategory}
                  onRemove={budget.removeCategory}
                />
              )}
              {activeTab === 'savings' && (
                <SavingsBucketsPanel
                  buckets={budget.buckets}
                  getBucketTotal={budget.getBucketTotal}
                  onAdd={budget.addBucket}
                  onUpdate={budget.updateBucket}
                  onRemove={budget.removeBucket}
                />
              )}
              {activeTab === 'shares' && (
                <SharesPanel buckets={budget.buckets} onViewShared={(shareId: string, ownerUsername: string) => setViewingShare({ shareId, ownerUsername })} />
              )}
            </div>
          </div>
        )}

        {/* Center: Sankey */}
        <div style={{ ...panelStyle, flex: 1, minWidth: 0 }}>
          <div style={panelHeader}>
            <span style={sectionTitle}>{isHistorical ? 'Actual Spending' : 'Budget Flow'}</span>
            <span style={{ fontSize: 11, color: '#8892b0' }}>
              {isHistorical ? 'Actuals — targets shown as variance' : month.income > 0 ? 'Showing actual flow' : 'Import a statement or add income to visualize'}
            </span>
          </div>

          <div ref={containerRef} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflow: 'hidden', minHeight: 280 }}>
            <SankeyDiagram data={sankeyData} width={dims.width} height={dims.height} />
          </div>

          {/* Variance badges for historical months */}
          {isHistorical && month.income > 0 && (
            <div style={{ borderTop: '1px solid #2e3355', padding: '8px 14px', display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {budget.categories.map((cat) => {
                const actual = month.spending[cat.id] || 0;
                if (!actual && !cat.target_amount) return null;
                const pct = cat.target_amount > 0 ? ((actual - cat.target_amount) / cat.target_amount) * 100 : 0;
                const over = pct > 0;
                return (
                  <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 20, background: over ? '#ef444415' : '#10b98115', border: `1px solid ${over ? '#ef444430' : '#10b98130'}` }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: cat.color }} />
                    <span style={{ fontSize: 11, color: '#e2e8f0' }}>{cat.name}</span>
                    {cat.target_amount > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: over ? '#ef4444' : '#10b981' }}>
                        {formatVariance(pct)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Month totals summary (non-historical) */}
          {!isHistorical && month.income > 0 && (
            <div style={{ borderTop: '1px solid #2e3355', padding: '8px 14px', display: 'flex', gap: 16, justifyContent: 'center' }}>
              {[
                { label: 'Income', value: month.income, color: '#10b981' },
                { label: 'Expenses', value: Object.values(month.spending).reduce((a, b) => a + b, 0), color: '#ef4444' },
                { label: 'Savings', value: Object.values(month.savingsContributions).reduce((a, b) => a + b, 0), color: '#6366f1' },
              ].map(({ label, value, color }) => value > 0 ? (
                <div key={label} style={{ fontSize: 12 }}>
                  <span style={{ color: '#8892b0' }}>{label}: </span>
                  <span style={{ color, fontWeight: 600 }}>{formatCurrency(value)}</span>
                </div>
              ) : null)}
            </div>
          )}
        </div>

        {/* Right panel: transactions */}
        {rightOpen && (
          <div style={{ ...panelStyle, width: 250, flexShrink: 0 }}>
            <div style={panelHeader}>
              <span style={sectionTitle}>{isHistorical ? 'Recorded' : 'This Month'}</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 12 }} className="scrollbar-thin">
              <MonthPanel
                monthId={currentMonthId}
                categories={budget.categories}
                buckets={budget.buckets}
                rules={budget.rules}
                transactions={currentTxns}
                onImport={handleImport}
              />
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {(user.forcePasswordChange || showChangePassword) && (
        <ChangePasswordModal
          forced={user.forcePasswordChange}
          onClose={user.forcePasswordChange ? undefined : () => setShowChangePassword(false)}
        />
      )}

      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}

      {viewingShare && (
        <SharedBudgetView
          shareId={viewingShare.shareId}
          ownerUsername={viewingShare.ownerUsername}
          onClose={() => setViewingShare(null)}
        />
      )}
    </div>
  );
}
