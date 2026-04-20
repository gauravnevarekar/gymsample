import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError('Failed to log in: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-on-surface">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="font-['Lexend'] font-black text-orange-500 text-5xl tracking-widest mb-2 italic">GYMFLOW</div>
        <h2 className="mt-6 text-center text-xl font-bold tracking-tight text-white uppercase">
          Sign in to Dashboard
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface-container-low py-8 px-4 shadow sm:rounded-xl sm:px-10 border border-outline-variant/10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && <div className="bg-error/10 text-error p-3 rounded text-sm text-center">{error}</div>}
            
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Email address</label>
              <div className="mt-1">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="block w-full rounded bg-zinc-900 border-zinc-700 text-white focus:border-orange-500 focus:ring-orange-500 sm:text-sm px-4 py-3"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Password</label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="block w-full rounded bg-zinc-900 border-zinc-700 text-white focus:border-orange-500 focus:ring-orange-500 sm:text-sm px-4 py-3"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-full shadow-sm text-sm font-bold text-zinc-950 bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
              >
                Sign In
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
