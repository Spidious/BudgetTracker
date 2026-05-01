import { useState } from 'react';
import type { FormEvent } from 'react';
import { api, ApiError } from '../api/client';
import { useAuthStore } from '../store/authStore';
import type { User } from '../types/api';

const S = {
  page: { minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 } as React.CSSProperties,
  card: { background: '#1a1d2e', border: '1px solid #2e3355', borderRadius: 16, padding: 36, width: '100%', maxWidth: 380 } as React.CSSProperties,
  logo: { width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, margin: '0 auto 20px' } as React.CSSProperties,
  title: { fontSize: 22, fontWeight: 700, color: '#e2e8f0', textAlign: 'center', marginBottom: 4 } as React.CSSProperties,
  sub: { fontSize: 13, color: '#8892b0', textAlign: 'center', marginBottom: 28 } as React.CSSProperties,
  label: { display: 'block', fontSize: 12, color: '#8892b0', marginBottom: 6 } as React.CSSProperties,
  input: { width: '100%', background: '#0f1117', border: '1px solid #2e3355', color: '#e2e8f0', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box' } as React.CSSProperties,
  btn: { width: '100%', background: '#6366f1', border: 'none', color: '#fff', borderRadius: 8, padding: '11px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 20 } as React.CSSProperties,
  err: { background: '#ef444420', border: '1px solid #ef444440', color: '#ef4444', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginBottom: 16 } as React.CSSProperties,
  toggle: { textAlign: 'center', marginTop: 18, fontSize: 13, color: '#8892b0' } as React.CSSProperties,
  link: { color: '#6366f1', cursor: 'pointer', background: 'none', border: 'none', fontSize: 13, padding: 0 } as React.CSSProperties,
};

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const setUser = useAuthStore((s) => s.setUser);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api.post<{ user: User }>(
        mode === 'login' ? '/auth/login' : '/auth/register',
        { username: username.trim(), password }
      );
      setUser(res.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>💰</div>
        <div style={S.title}>BudgetFlow</div>
        <div style={S.sub}>{mode === 'login' ? 'Sign in to your account' : 'Create a new account'}</div>

        {error && <div style={S.err}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>Username</label>
            <input style={S.input} value={username} onChange={(e) => setUsername(e.target.value)}
              autoComplete="username" autoFocus required />
          </div>
          <div>
            <label style={S.label}>Password</label>
            <input style={S.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
          </div>
          <button type="submit" style={{ ...S.btn, opacity: busy ? 0.7 : 1 }} disabled={busy}>
            {busy ? '…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={S.toggle}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button style={S.link} onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
