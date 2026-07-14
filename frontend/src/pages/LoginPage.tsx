import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const { user, loginWithPassword, signupWithPassword } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [phoneNumber, setPhoneNumber] = useState('+1555');
  const [password, setPassword] = useState('Password123!');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const title = useMemo(() => (mode === 'login' ? 'Welcome Back' : 'Create Account'), [mode]);

  if (user) {
    return <Navigate to="/groups" replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === 'login') {
        await loginWithPassword(phoneNumber.trim(), password);
      } else {
        await signupWithPassword(phoneNumber.trim(), password, name.trim() || undefined);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1>{title}</h1>
        <p className="muted">PulseChat app user auth</p>

        <label>
          Phone Number
          <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} required />
        </label>

        {mode === 'signup' && (
          <label>
            Name (optional)
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        )}

        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Working...' : mode === 'login' ? 'Login' : 'Create Account'}
        </button>

        <button
          type="button"
          className="ghost"
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
        >
          {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Log in'}
        </button>
      </form>
    </div>
  );
}
