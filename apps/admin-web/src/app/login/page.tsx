'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { staffLogin } from '@/services/auth';
import { setSession } from '@/lib/session';
import { ApiError } from '@/lib/http';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const session = await staffLogin(email, password);
      setSession(session);
      router.push('/');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('حصلت مشكلة');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--ftc-paper)' }}>
      <div className="ftc-card" style={{ maxWidth: '400px', width: '100%' }}>
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <h1 className="ftc-h1" style={{ marginBottom: '8px' }}>دخول الموظفين</h1>
          <p className="ftc-body ftc-muted">مركز القيادة - FixTheCity</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="ftc-field">
            <label className="ftc-label">البريد الإلكتروني</label>
            <input
              className="ftc-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="ftc-field">
            <label className="ftc-label">كلمة السر</label>
            <input
              className="ftc-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          {error && <div className="ftc-error">{error}</div>}

          <button
            type="submit"
            className="ftc-btn ftc-btn--primary ftc-btn--block"
            disabled={loading}
          >
            {loading ? 'جاري الدخول...' : 'دخول'}
          </button>
        </form>
      </div>
    </div>
  );
}
