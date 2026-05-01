import { useState, useEffect, useRef } from 'react';
import { api, ApiError } from '../api/client';
import type { SharedView } from '../types/api';
import { buildSankeyData } from '../utils/sankeyUtils';
import { formatMonthLabel, formatVariance } from '../utils/sankeyUtils';
import SankeyDiagram from './SankeyDiagram';

interface Props {
  shareId: string;
  ownerUsername: string;
  onClose: () => void;
}

function getCurrentMonthId() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function navigateMonth(id: string, dir: 1 | -1): string {
  const [y, m] = id.split('-').map(Number);
  const d = new Date(y, m - 1 + dir, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function SharedBudgetView({ shareId, ownerUsername, onClose }: Props) {
  const [data, setData] = useState<SharedView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthId());
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 600, height: 380 });

  useEffect(() => {
    api.get<SharedView>(`/shares/${shareId}/view`)
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [shareId]);

  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) {
        setDims({ width: Math.max(300, e.contentRect.width - 40), height: Math.max(200, e.contentRect.height - 40) });
      }
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  if (loading) return (
    <Overlay onClose={onClose} title={`${ownerUsername}'s Budget`}>
      <div style={{ padding: 40, textAlign: 'center', color: '#8892b0' }}>Loading…</div>
    </Overlay>
  );

  if (error || !data) return (
    <Overlay onClose={onClose} title="Error">
      <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>{error || 'No data'}</div>
    </Overlay>
  );

  const availableMonths = Object.keys(data.months).sort();
  const month = data.months[currentMonth] ?? { monthId: currentMonth, income: 0, spending: {}, savingsContributions: {} };
  const isHistorical = currentMonth < getCurrentMonthId();

  const cats = data.categories;
  const bkts = data.savingsBuckets;
  const sankeyData = buildSankeyData(month, cats, bkts, isHistorical);

  const canNav = (dir: 1 | -1) => {
    const next = navigateMonth(currentMonth, dir);
    return availableMonths.includes(next);
  };

  return (
    <Overlay onClose={onClose} title={`${ownerUsername}'s Budget`}>
      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #2e3355' }}>
        <button onClick={() => canNav(-1) && setCurrentMonth(navigateMonth(currentMonth, -1))}
          disabled={!canNav(-1)}
          style={{ background: '#242740', border: '1px solid #2e3355', color: canNav(-1) ? '#e2e8f0' : '#475569', borderRadius: 8, width: 32, height: 32, cursor: canNav(-1) ? 'pointer' : 'default', fontSize: 18 }}>
          ‹
        </button>
        <span style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', minWidth: 160, textAlign: 'center' }}>
          {formatMonthLabel(currentMonth)}
        </span>
        <button onClick={() => canNav(1) && setCurrentMonth(navigateMonth(currentMonth, 1))}
          disabled={!canNav(1)}
          style={{ background: '#242740', border: '1px solid #2e3355', color: canNav(1) ? '#e2e8f0' : '#475569', borderRadius: 8, width: 32, height: 32, cursor: canNav(1) ? 'pointer' : 'default', fontSize: 18 }}>
          ›
        </button>
      </div>

      {!data.months[currentMonth] ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8892b0', fontSize: 14 }}>
          {availableMonths.length === 0
            ? 'No data shared for this period'
            : `No data for this month. Available: ${availableMonths.map(formatMonthLabel).join(', ')}`}
        </div>
      ) : (
        <>
          <div ref={containerRef} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflow: 'hidden', minHeight: 280 }}>
            <SankeyDiagram data={sankeyData} width={dims.width} height={dims.height} />
          </div>

          {/* Variance badges for historical */}
          {isHistorical && month.income > 0 && (
            <div style={{ borderTop: '1px solid #2e3355', padding: '10px 16px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {cats.map((cat) => {
                const actual = month.spending[cat.id] || 0;
                if (!actual && !cat.target_amount) return null;
                const pct = cat.target_amount > 0 ? ((actual - cat.target_amount) / cat.target_amount) * 100 : 0;
                const over = pct > 0;
                return (
                  <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: over ? '#ef444415' : '#10b98115', border: `1px solid ${over ? '#ef444430' : '#10b98130'}` }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: cat.color }} />
                    <span style={{ fontSize: 12, color: '#e2e8f0' }}>{cat.name}</span>
                    {cat.target_amount > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: over ? '#ef4444' : '#10b981' }}>
                        {formatVariance(pct)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Savings summary */}
          {bkts.length > 0 && (
            <div style={{ borderTop: '1px solid #2e3355', padding: '10px 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {bkts.map((b) => {
                const total = Object.values(data.months).reduce((s, m) => s + (m.savingsContributions[b.id] || 0), 0);
                const pct = b.target_amount > 0 ? Math.min(100, (total / b.target_amount) * 100) : 0;
                return (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: '#242740', border: '1px solid #2e3355' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: b.color }} />
                    <span style={{ fontSize: 12, color: '#e2e8f0' }}>{b.name}</span>
                    <span style={{ fontSize: 11, color: '#8892b0' }}>${total.toLocaleString()}{b.target_amount > 0 ? ` (${pct.toFixed(0)}%)` : ''}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </Overlay>
  );
}

function Overlay({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000cc', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#1a1d2e', border: '1px solid #2e3355', borderRadius: 16, width: '100%', maxWidth: 900, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #2e3355', flexShrink: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8892b0', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
