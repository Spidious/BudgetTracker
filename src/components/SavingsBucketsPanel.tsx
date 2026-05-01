import { useState } from 'react';
import { formatCurrency } from '../utils/sankeyUtils';
import type { SavingsBucket } from '../types/api';

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#10b981', '#06b6d4',
  '#3b82f6', '#a855f7', '#14b8a6', '#f43f5e',
];

interface Props {
  buckets: SavingsBucket[];
  getBucketTotal: (id: string) => number;
  onAdd: (name: string, targetAmount: number, color: string) => Promise<unknown>;
  onUpdate: (id: string, updates: { name?: string; target_amount?: number; color?: string }) => Promise<unknown>;
  onRemove: (id: string) => Promise<unknown>;
}

export default function SavingsBucketsPanel({ buckets, getBucketTotal, onAdd, onUpdate, onRemove }: Props) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[3]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const inp: React.CSSProperties = {
    background: '#0f1117', border: '1px solid #2e3355', color: '#e2e8f0',
    borderRadius: 6, padding: '6px 10px', fontSize: 13, outline: 'none',
  };

  async function handleAdd() {
    if (!newName.trim()) return;
    await onAdd(newName.trim(), parseFloat(newTarget) || 0, newColor);
    setNewName(''); setNewTarget(''); setAdding(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {buckets.length === 0 && !adding && (
        <p style={{ fontSize: 12, color: '#8892b0', margin: 0 }}>
          Track long-term savings goals that accumulate across months.
        </p>
      )}

      {buckets.map((bucket) => {
        const saved = getBucketTotal(bucket.id);
        const pct = bucket.target_amount > 0 ? Math.min(100, (saved / bucket.target_amount) * 100) : 0;

        if (editingId === bucket.id) {
          return (
            <BucketEditRow
              key={bucket.id}
              bucket={bucket}
              onSave={(u) => { onUpdate(bucket.id, u); setEditingId(null); }}
              onCancel={() => setEditingId(null)}
              inp={inp}
            />
          );
        }

        return (
          <div key={bucket.id} style={{ background: '#1a1d2e', borderRadius: 8, padding: 12, border: '1px solid #2e3355' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: bucket.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#e2e8f0' }}>{bucket.name}</span>
              <button onClick={() => setEditingId(bucket.id)} style={{ background: 'transparent', border: 'none', color: '#8892b0', cursor: 'pointer', fontSize: 13, padding: '2px 4px' }}>✎</button>
              <button onClick={() => onRemove(bucket.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}>×</button>
            </div>
            <div style={{ background: '#0f1117', borderRadius: 4, height: 6, marginBottom: 6 }}>
              <div style={{ background: bucket.color, borderRadius: 4, height: '100%', width: `${pct}%`, transition: 'width 0.3s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{formatCurrency(saved)} saved</span>
              {bucket.target_amount > 0 && (
                <span style={{ color: '#8892b0' }}>{formatCurrency(bucket.target_amount)} goal ({pct.toFixed(0)}%)</span>
              )}
            </div>
          </div>
        );
      })}

      {adding ? (
        <div style={{ background: '#1a1d2e', border: '1px solid #2e3355', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input type="text" placeholder="Goal name (e.g. New Car)" value={newName} onChange={(e) => setNewName(e.target.value)}
            style={{ ...inp, width: '100%' }} autoFocus />
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#8892b0', fontSize: 13 }}>$</span>
            <input type="number" placeholder="Goal amount" value={newTarget} onChange={(e) => setNewTarget(e.target.value)}
              style={{ ...inp, paddingLeft: 22, width: '100%' }} />
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {PRESET_COLORS.map((c) => (
              <button key={c} onClick={() => setNewColor(c)}
                style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: newColor === c ? '2px solid #e2e8f0' : '2px solid transparent', cursor: 'pointer', padding: 0 }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleAdd}
              style={{ background: '#6366f1', border: 'none', color: '#fff', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer', flex: 1 }}>
              Add Goal
            </button>
            <button onClick={() => { setAdding(false); setNewName(''); setNewTarget(''); }}
              style={{ background: 'transparent', border: '1px solid #2e3355', color: '#8892b0', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          style={{ background: 'transparent', border: '1px dashed #2e3355', color: '#6366f1', borderRadius: 8, padding: '8px', fontSize: 12, cursor: 'pointer', width: '100%' }}>
          + New Savings Goal
        </button>
      )}
    </div>
  );
}

interface EditRowProps {
  bucket: SavingsBucket;
  onSave: (u: { name?: string; target_amount?: number; color?: string }) => void;
  onCancel: () => void;
  inp: React.CSSProperties;
}

function BucketEditRow({ bucket, onSave, onCancel, inp }: EditRowProps) {
  const [name, setName] = useState(bucket.name);
  const [target, setTarget] = useState(String(bucket.target_amount));
  const [color, setColor] = useState(bucket.color);

  return (
    <div style={{ background: '#1a1d2e', border: '1px solid #6366f1', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ ...inp, width: '100%' }} autoFocus />
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#8892b0', fontSize: 13 }}>$</span>
        <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} style={{ ...inp, paddingLeft: 22, width: '100%' }} />
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {PRESET_COLORS.map((c) => (
          <button key={c} onClick={() => setColor(c)}
            style={{ width: 18, height: 18, borderRadius: '50%', background: c, border: color === c ? '2px solid #e2e8f0' : '2px solid transparent', cursor: 'pointer', padding: 0 }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => onSave({ name, target_amount: parseFloat(target) || 0, color })}
          style={{ background: '#6366f1', border: 'none', color: '#fff', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', flex: 1 }}>
          Save
        </button>
        <button onClick={onCancel}
          style={{ background: 'transparent', border: '1px solid #2e3355', color: '#8892b0', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
