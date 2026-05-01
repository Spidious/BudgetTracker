import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../api/client';
import type { AdminUser } from '../types/api';

interface Props { onClose: () => void; }

export default function AdminPanel({ onClose }: Props) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [tempPasswords, setTempPasswords] = useState<Record<string, string>>({});
  const [newUsername, setNewUsername] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [createError, setCreateError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<AdminUser[]>('/admin/users');
      setUsers(data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function resetPassword(userId: string) {
    setBusy(userId);
    try {
      const res = await api.post<{ username: string; temporaryPassword: string }>(`/admin/users/${userId}/reset-password`);
      setTempPasswords((p) => ({ ...p, [userId]: res.temporaryPassword }));
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Failed to reset password');
    } finally { setBusy(null); }
  }

  async function deleteUser(userId: string, username: string) {
    if (!confirm(`Delete user "${username}"? This will remove all their budget data.`)) return;
    setBusy(userId);
    try {
      await api.delete(`/admin/users/${userId}`);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Failed to delete user');
    } finally { setBusy(null); }
  }

  async function createUser() {
    if (!newUsername.trim()) { setCreateError('Username required'); return; }
    setCreateError(''); setBusy('create');
    try {
      const res = await api.post<{ id: string; username: string; temporaryPassword: string }>('/admin/users', {
        username: newUsername.trim(), isAdmin: newIsAdmin,
      });
      setTempPasswords((p) => ({ ...p, [res.id]: res.temporaryPassword }));
      setNewUsername('');
      setNewIsAdmin(false);
      await load();
    } catch (e) {
      setCreateError(e instanceof ApiError ? e.message : 'Failed to create user');
    } finally { setBusy(null); }
  }

  const cell: React.CSSProperties = { padding: '10px 14px', fontSize: 13, color: '#e2e8f0', borderBottom: '1px solid #2e3355' };
  const hcell: React.CSSProperties = { ...cell, color: '#8892b0', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000cc', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#1a1d2e', border: '1px solid #2e3355', borderRadius: 16, width: '100%', maxWidth: 720, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #2e3355', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>Admin Panel</div>
            <div style={{ fontSize: 12, color: '#8892b0', marginTop: 2 }}>User management only — budget data is private</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8892b0', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

          {/* Create user */}
          <div style={{ marginBottom: 20, padding: 14, background: '#242740', borderRadius: 10, border: '1px solid #2e3355' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#8892b0', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Create User</div>
            {createError && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 8 }}>{createError}</div>}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                value={newUsername} onChange={(e) => { setNewUsername(e.target.value); setCreateError(''); }}
                placeholder="Username"
                style={{ background: '#0f1117', border: '1px solid #2e3355', color: '#e2e8f0', borderRadius: 6, padding: '8px 12px', fontSize: 13, outline: 'none', flex: 1, minWidth: 140 }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#8892b0', cursor: 'pointer', userSelect: 'none' }}>
                <input type="checkbox" checked={newIsAdmin} onChange={(e) => setNewIsAdmin(e.target.checked)} />
                Admin
              </label>
              <button onClick={createUser} disabled={busy === 'create'}
                style={{ background: '#6366f1', border: 'none', color: '#fff', borderRadius: 6, padding: '8px 16px', fontSize: 13, cursor: 'pointer', opacity: busy === 'create' ? 0.7 : 1 }}>
                Create
              </button>
            </div>
          </div>

          {/* Users table */}
          {loading ? (
            <div style={{ textAlign: 'center', color: '#8892b0', padding: 20 }}>Loading…</div>
          ) : (
            <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #2e3355' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#242740' }}>
                    <th style={{ ...hcell, textAlign: 'left' }}>Username</th>
                    <th style={{ ...hcell, textAlign: 'left' }}>Role</th>
                    <th style={{ ...hcell, textAlign: 'left' }}>Created</th>
                    <th style={{ ...hcell, textAlign: 'left' }}>Status</th>
                    <th style={{ ...hcell, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <>
                      <tr key={u.id} style={{ background: '#1a1d2e' }}>
                        <td style={cell}><span style={{ fontWeight: 500 }}>{u.username}</span></td>
                        <td style={cell}>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: u.is_admin ? '#6366f120' : '#242740', color: u.is_admin ? '#6366f1' : '#8892b0', border: `1px solid ${u.is_admin ? '#6366f140' : '#2e3355'}` }}>
                            {u.is_admin ? 'Admin' : 'User'}
                          </span>
                        </td>
                        <td style={{ ...cell, color: '#8892b0' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                        <td style={cell}>
                          {u.force_password_change ? (
                            <span style={{ fontSize: 11, color: '#f59e0b' }}>⚠ Must change password</span>
                          ) : (
                            <span style={{ fontSize: 11, color: '#10b981' }}>Active</span>
                          )}
                        </td>
                        <td style={{ ...cell, textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button onClick={() => resetPassword(u.id)} disabled={busy === u.id}
                              style={{ background: '#242740', border: '1px solid #2e3355', color: '#e2e8f0', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', opacity: busy === u.id ? 0.6 : 1 }}>
                              Reset Password
                            </button>
                            <button onClick={() => deleteUser(u.id, u.username)} disabled={busy === u.id}
                              style={{ background: '#ef444415', border: '1px solid #ef444430', color: '#ef4444', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', opacity: busy === u.id ? 0.6 : 1 }}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Show temp password inline if just reset */}
                      {tempPasswords[u.id] && (
                        <tr key={`${u.id}-tmp`} style={{ background: '#f59e0b10' }}>
                          <td colSpan={5} style={{ padding: '8px 14px', borderBottom: '1px solid #2e3355' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 12, color: '#f59e0b' }}>⚠ Temporary password (shown once):</span>
                              <code style={{ background: '#0f1117', border: '1px solid #2e3355', borderRadius: 4, padding: '3px 8px', fontSize: 13, color: '#e2e8f0', letterSpacing: '0.05em' }}>
                                {tempPasswords[u.id]}
                              </code>
                              <button onClick={() => navigator.clipboard.writeText(tempPasswords[u.id])}
                                style={{ background: 'none', border: '1px solid #2e3355', color: '#8892b0', borderRadius: 4, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
                                Copy
                              </button>
                              <button onClick={() => setTempPasswords((p) => { const n = { ...p }; delete n[u.id]; return n; })}
                                style={{ background: 'none', border: 'none', color: '#8892b0', cursor: 'pointer', fontSize: 16, marginLeft: 'auto' }}>
                                ×
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
