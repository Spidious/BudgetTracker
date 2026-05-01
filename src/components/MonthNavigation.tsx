import { useUiStore, getCurrentMonthId } from '../store/uiStore';
import { formatMonthLabel } from '../utils/sankeyUtils';

export default function MonthNavigation() {
  const { currentMonthId, navigateMonth } = useUiStore();
  const isCurrent = currentMonthId === getCurrentMonthId();
  const isHistorical = currentMonthId < getCurrentMonthId();

  const btnStyle: React.CSSProperties = {
    background: '#1a1d2e', border: '1px solid #2e3355', color: '#e2e8f0',
    borderRadius: 8, width: 36, height: 36, cursor: 'pointer', fontSize: 18,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button style={btnStyle} onClick={() => navigateMonth(-1)}>‹</button>
      <div style={{ textAlign: 'center', minWidth: 180 }}>
        <div style={{ fontSize: 20, fontWeight: 600, color: '#e2e8f0' }}>{formatMonthLabel(currentMonthId)}</div>
        {isCurrent && <div style={{ fontSize: 11, color: '#10b981', marginTop: 2 }}>Current Month</div>}
        {isHistorical && <div style={{ fontSize: 11, color: '#8892b0', marginTop: 2 }}>Historical</div>}
        {!isCurrent && !isHistorical && <div style={{ fontSize: 11, color: '#6366f1', marginTop: 2 }}>Future</div>}
      </div>
      <button style={btnStyle} onClick={() => navigateMonth(1)}>›</button>
    </div>
  );
}
