import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';

export default function ForceChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { currentUser, mustChangePassword, logout } = useAuth();
  const navigate = useNavigate();

  // If somehow the user gets here and they don't need to change password, kick them out
  useEffect(() => {
    if (mustChangePassword === false) {
      navigate('/', { replace: true });
    }
  }, [mustChangePassword, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!currentPassword) {
      return setError('Please enter the temporary password provided by the administrator.');
    }
    if (newPassword.length < 6) {
      return setError('Password must be at least 6 characters long.');
    }
    if (newPassword !== confirmPassword) {
      return setError('Passwords do not match.');
    }
    
    try {
      setError('');
      setLoading(true);
      
      // 1. Re-authenticate to satisfy recent-login requirements
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);

      // 2. Update password using Client Auth SDK
      await updatePassword(currentUser, newPassword);
      
      // 3. Remove the flag in Firestore
      await updateDoc(doc(db, 'gyms', currentUser.uid), {
        mustChangePassword: false
      });
      
      // 4. The ProtectedRoute will now allow them into the app naturally
      navigate('/', { replace: true });
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Incorrect temporary password. Please check the password provided by the admin.');
      } else {
        setError('Failed to update password: ' + err.message);
      }
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center px-4 py-8 sm:px-6 lg:px-8 text-on-surface">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="font-['Lexend'] font-black text-orange-500 text-4xl sm:text-5xl tracking-widest mb-2 italic">GYMFLOW</div>
        <h2 className="mt-6 text-center text-xl font-bold tracking-tight text-white uppercase">
          Update Required
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Your account was recovered by an administrator. For your security, you must choose a new password before accessing your dashboard.
        </p>
      </div>

      <div className="mt-8 w-full sm:mx-auto sm:max-w-md">
        <div className="bg-zinc-900 py-8 px-4 shadow sm:rounded-xl sm:px-10 border border-zinc-800">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && <div className="bg-red-500/10 text-red-400 border border-red-500/20 p-3 rounded text-sm text-center">{error}</div>}
            
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Current (Temporary) Password</label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="block w-full rounded bg-zinc-950 border border-zinc-800 text-white focus:border-orange-500 focus:ring-orange-500 sm:text-sm px-4 py-3 outline-none"
                  placeholder="Enter the password from the admin"
                />
              </div>
            </div>

            <div className="border-t border-zinc-800 pt-4">
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">New Password</label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="block w-full rounded bg-zinc-950 border border-zinc-800 text-white focus:border-orange-500 focus:ring-orange-500 sm:text-sm px-4 py-3 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Confirm New Password</label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="block w-full rounded bg-zinc-950 border border-zinc-800 text-white focus:border-orange-500 focus:ring-orange-500 sm:text-sm px-4 py-3 outline-none"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-full shadow-sm text-sm font-bold text-zinc-950 bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 transition"
              >
                {loading ? 'Updating...' : 'Set Password & Continue'}
              </button>
            </div>
            
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={logout}
                className="text-xs text-zinc-500 hover:text-white transition uppercase tracking-wider"
              >
                Sign out instead
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
