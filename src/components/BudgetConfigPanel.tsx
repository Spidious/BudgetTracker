import { useState } from 'react';
import { useBudgetStore } from '../store/budgetStore';
import { formatCurrency } from '../utils/sankeyUtils';
import type { BudgetCategory } from '../types';

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#10b981', '#06b6d4',
  '#3b82f6', '#a855f7', '#14b8a6', '#f43f5e',
];

export default function BudgetConfigPanel() {
  const { budgetCategories, addCategory, updateCategory, removeCategory } = useBudgetStore();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const inputStyle = {
    background: '#0f1117',
    border: '1px solid #2e3355',
    color: '#e2e8f0',
    borderRadius: 6,
    padding: '6px 10px',
    fontSize: 13,
    outline: 'none',
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    addCategory(newName.trim(), parseFloat(newAmount) || 0, newColor);
    setNewName('');
    setNewAmount('');
    setNewColor(PRESET_COLORS[0]);
    setAdding(false);
  };

  const totalTarget = budgetCategories.reduce((s, c) => s + c.targetAmount, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 11, color: '#8892b0' }}>
          Total target: {formatCurrency(totalTarget)}/mo
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            style={{
              background: 'transparent',
              border: '1px solid #2e3355',
              color: '#6366f1',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            + Add
          </button>
        )}
      </div>

      {budgetCategories.map((cat) => (
        <CategoryRow
          key={cat.id}
          cat={cat}
          isEditing={editingId === cat.id}
          onEdit={() => setEditingId(cat.id)}
          onDone={() => setEditingId(null)}
          onUpdate={(u) => updateCategory(cat.id, u)}
          onRemove={() => removeCategory(cat.id)}
          inputStyle={inputStyle}
          presetColors={PRESET_COLORS}
        />
      ))}

      {adding && (
        <div style={{ background: '#1a1d2e', border: '1px solid #2e3355', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            type="text"
            placeholder="Category name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ ...inputStyle, width: '100%' }}
            autoFocus
          />
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#8892b0', fontSize: 13 }}>$</span>
            <input
              type="number"
              placeholder="Monthly target"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 22, width: '100%' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                style={{
                  width: 20, height: 20, borderRadius: '50%', background: c, border: newColor === c ? '2px solid #e2e8f0' : '2px solid transparent', cursor: 'pointer', padding: 0,
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleAdd}
              style={{
                background: '#6366f1', border: 'none', color: '#fff', borderRadius: 6,
                padding: '6px 14px', fontSize: 12, cursor: 'pointer', flex: 1,
              }}
            >
              Add
            </button>
            <button
              onClick={() => { setAdding(false); setNewName(''); setNewAmount(''); }}
              style={{
                background: 'transparent', border: '1px solid #2e3355', color: '#8892b0',
                borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface CategoryRowProps {
  cat: BudgetCategory;
  isEditing: boolean;
  onEdit: () => void;
  onDone: () => void;
  onUpdate: (u: Partial<Omit<BudgetCategory, 'id'>>) => void;
  onRemove: () => void;
  inputStyle: React.CSSProperties;
  presetColors: string[];
}

function CategoryRow({ cat, isEditing, onEdit, onDone, onUpdate, onRemove, inputStyle, presetColors }: CategoryRowProps) {
  const [name, setName] = useState(cat.name);
  const [amount, setAmount] = useState(String(cat.targetAmount));
  const [color, setColor] = useState(cat.color);

  if (!isEditing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, background: '#1a1d2e' }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 13, color: '#e2e8f0' }}>{cat.name}</span>
        <span style={{ fontSize: 12, color: '#8892b0' }}>{formatCurrency(cat.targetAmount)}</span>
        <button
          onClick={onEdit}
          style={{ background: 'transparent', border: 'none', color: '#8892b0', cursor: 'pointer', fontSize: 13, padding: '2px 4px' }}
        >
          ✎
        </button>
        <button
          onClick={onRemove}
          style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 13, padding: '2px 4px' }}
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: '#1a1d2e', border: '1px solid #2e3355', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ ...inputStyle, width: '100%' }}
        autoFocus
      />
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#8892b0', fontSize: 13 }}>$</span>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ ...inputStyle, paddingLeft: 22, width: '100%' }}
        />
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {presetColors.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            style={{ width: 18, height: 18, borderRadius: '50%', background: c, border: color === c ? '2px solid #e2e8f0' : '2px solid transparent', cursor: 'pointer', padding: 0 }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => { onUpdate({ name, targetAmount: parseFloat(amount) || 0, color }); onDone(); }}
          style={{ background: '#6366f1', border: 'none', color: '#fff', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', flex: 1 }}
        >
          Save
        </button>
        <button
          onClick={onDone}
          style={{ background: 'transparent', border: '1px solid #2e3355', color: '#8892b0', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
