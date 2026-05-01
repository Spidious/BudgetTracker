import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../api/client';
import type { Share, SavingsBucket } from '../types/api';

interface Props {
  buckets: SavingsBucket[];
  onViewShared: (shareId: string, ownerUsername: string) => void;
}

const row: React.CSSProperties = { background: '#0f1117', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 };
const badge = (on: boolean): React.CSSProperties => ({ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: on ? '#10b98120' : '#ef444420', color: on ? '#10b981' : '#ef4444', border: `1px solid ${on ? '#10b98130' : '#ef444430'}`, cursor: 'pointer', userSelect: 'none' });
const inp: React.CSSProperties = { background: '#0f1117', border: '1px solid #2e3355', color: '#e2e8f0', borderRadius: 6, padding: '7px 10px', fontSize: 13, outline: 'none' };

export default function SharesPanel({ buckets, onViewShared }: Props) {
  const [outgoing, setOutgoing] = useState<Share[]>([]);
  const [incoming, setIncoming] = useState<Share[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ outgoing: Share[]; incoming: Share[] }>('/shares');
      setOutgoing(data.outgoing);
      setIncoming(data.incoming);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addShare() {
    if (!newUsername.trim()) return;
    setError(''); setBusy(true);
    try {
      await api.post('/shares', { recipientUsername: newUsername.trim() });
      setNewUsername('');
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to create share');
    } finally { setBusy(false); }
  }

  async function removeShare(id: string) {
    await api.delete(`/shares/${id}`);
    setOutgoing((prev) => prev.filter((s) => s.id !== id));
  }

  async function togglePerm(share: Share, key: 'can_see_history' | 'can_see_current_month') {
    const updated = { ...share, [key]: !share[key] };
    await api.put(`/shares/${share.id}`, {
      canSeeHistory: updated.can_see_history,
      canSeeCurrentMonth: updated.can_see_current_month,
    });
    setOutgoing((prev) => prev.map((s) => s.id === share.id ? updated : s));
  }

  async function toggleBucket(share: Share, bucketId: string) {
    const current = share.bucketVisibility?.[bucketId] ?? true;
    const updated: Share = {
      ...share,
      bucketVisibility: { ...(share.bucketVisibility ?? {}), [bucketId]: !current },
    };
    await api.put(`/shares/${share.id}`, { bucketVisibility: updated.bucketVisibility });
    setOutgoing((prev) => prev.map((s) => s.id === share.id ? updated : s));
  }

  const titleStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#8892b0', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Shared with me */}
      {incoming.length > 0 && (
        <div>
          <div style={titleStyle}>Shared With Me</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {incoming.map((s) => (
              <div key={s.id} style={row}>
                <div>
                  <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{s.owner_username}</div>
                  <div style={{ fontSize: 11, color: '#8892b0', marginTop: 2 }}>
                    {[s.can_see_history && 'history', s.can_see_current_month && 'current'].filter(Boolean).join(' + ') || 'limited access'}
                  </div>
                </div>
                <button
                  onClick={() => onViewShared(s.id, s.owner_username!)}
                  style={{ background: '#6366f1', border: 'none', color: '#fff', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>
                  View
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My shares */}
      <div>
        <div style={titleStyle}>Sharing With Others</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {outgoing.map((share) => (
            <div key={share.id} style={{ background: '#0f1117', borderRadius: 8, overflow: 'hidden', border: '1px solid #2e3355' }}>
              {/* Header row */}
              <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => setExpandedId(expandedId === share.id ? null : share.id)}
                  style={{ background: 'none', border: 'none', color: '#8892b0', cursor: 'pointer', fontSize: 12, padding: 0 }}>
                  {expandedId === share.id ? '▾' : '▸'}
                </button>
                <span style={{ flex: 1, fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{share.recipient_username}</span>
                <button onClick={() => togglePerm(share, 'can_see_history')} style={badge(share.can_see_history)}>
                  History
                </button>
                <button onClick={() => togglePerm(share, 'can_see_current_month')} style={badge(share.can_see_current_month)}>
                  Current
                </button>
                <button onClick={() => removeShare(share.id)}
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16, padding: '0 2px' }}>
                  ×
                </button>
              </div>

              {/* Expanded: per-bucket visibility */}
              {expandedId === share.id && buckets.length > 0 && (
                <div style={{ borderTop: '1px solid #2e3355', padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: '#8892b0', marginBottom: 8 }}>Savings Bucket Visibility</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {buckets.map((b) => {
                      const visible = share.bucketVisibility?.[b.id] ?? true;
                      return (
                        <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: b.color, display: 'inline-block' }} />
                            <span style={{ fontSize: 12, color: '#e2e8f0' }}>{b.name}</span>
                          </div>
                          <button onClick={() => toggleBucket(share, b.id)} style={badge(visible)}>
                            {visible ? 'Visible' : 'Hidden'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {expandedId === share.id && buckets.length === 0 && (
                <div style={{ borderTop: '1px solid #2e3355', padding: '10px 12px' }}>
                  <span style={{ fontSize: 12, color: '#8892b0' }}>No savings buckets yet</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add share */}
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {error && <div style={{ fontSize: 12, color: '#ef4444' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              style={{ ...inp, flex: 1 }}
              placeholder="Username to share with"
              value={newUsername}
              onChange={(e) => { setNewUsername(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && addShare()}
            />
            <button onClick={addShare} disabled={busy}
              style={{ background: '#6366f1', border: 'none', color: '#fff', borderRadius: 6, padding: '7px 14px', fontSize: 12, cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>
              Share
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
