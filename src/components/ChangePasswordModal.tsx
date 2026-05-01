import { useState } from 'react';
import type { FormEvent } from 'react';
import { api, ApiError } from '../api/client';
import { useAuthStore } from '../store/authStore';
import type { User } from '../types/api';

interface Props {
  forced?: boolean; // true = user must change password before continuing
  onClose?: () => void;
}

const inp: React.CSSProperties = { width: '100%', background: '#0f1117', border: '1px solid #2e3355', color: '#e2e8f0', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box' };

export default function ChangePasswordModal({ forced, onClose }: Props) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const setUser = useAuthStore((s) => s.setUser);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (next !== confirm) { setError('Passwords do not match'); return; }
    if (next.length < 8) { setError('Password must be at least 8 characters'); return; }
    setError('');
    setBusy(true);
    try {
      const res = await api.post<{ user: User }>('/auth/change-password', {
        currentPassword: current,
        newPassword: next,
      });
      setUser(res.user);
      onClose?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000cc', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#1a1d2e', border: '1px solid #2e3355', borderRadius: 16, padding: 32, width: '100%', maxWidth: 380 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>
          {forced ? '🔒 Password Change Required' : 'Change Password'}
        </div>
        {forced && (
          <p style={{ fontSize: 13, color: '#8892b0', marginBottom: 20, lineHeight: 1.5 }}>
            Your password was reset by an administrator. Please set a new password to continue.
          </p>
        )}

        {error && (
          <div style={{ background: '#ef444420', border: '1px solid #ef444440', color: '#ef4444', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#8892b0', marginBottom: 6 }}>Current Password</label>
            <input style={inp} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoFocus />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#8892b0', marginBottom: 6 }}>New Password</label>
            <input style={inp} type="password" value={next} onChange={(e) => setNext(e.target.value)} required />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#8892b0', marginBottom: 6 }}>Confirm New Password</label>
            <input style={inp} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="submit" disabled={busy}
              style={{ flex: 1, background: '#6366f1', border: 'none', color: '#fff', borderRadius: 8, padding: 11, fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>
              {busy ? '…' : 'Update Password'}
            </button>
            {!forced && onClose && (
              <button type="button" onClick={onClose}
                style={{ background: 'transparent', border: '1px solid #2e3355', color: '#8892b0', borderRadius: 8, padding: 11, fontSize: 14, cursor: 'pointer' }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
