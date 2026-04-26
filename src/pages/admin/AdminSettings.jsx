import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';

export default function AdminSettings() {
  const { currentUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handlePasswordChange(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword) {
      return setError('Please enter your current password.');
    }
    if (newPassword.length < 6) {
      return setError('New password must be at least 6 characters long.');
    }
    if (newPassword === currentPassword) {
      return setError('New password cannot be the same as the current password.');
    }
    if (newPassword !== confirmPassword) {
      return setError('Confirm password does not match.');
    }

    setLoading(true);

    try {
      // 1. Re-authenticate
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);

      // 2. Update password
      await updatePassword(currentUser, newPassword);

      // 3. Success state
      setSuccess('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Incorrect current password.');
      } else {
        setError('Failed to update password: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 text-zinc-100 max-w-4xl">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-xl font-bold mb-4">Admin Settings</h2>
        
        <div className="border border-zinc-800 rounded-lg p-6 bg-zinc-950/50">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-orange-500">lock</span>
            Change Password
          </h3>
          
          <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
            {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded text-sm">{error}</div>}
            {success && <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-3 rounded text-sm">{success}</div>}
            
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Current Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="block w-full rounded bg-zinc-900 border border-zinc-800 text-white focus:border-orange-500 focus:ring-orange-500 sm:text-sm px-4 py-3 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div className="border-t border-zinc-800/50 pt-4">
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="block w-full rounded bg-zinc-900 border border-zinc-800 text-white focus:border-orange-500 focus:ring-orange-500 sm:text-sm px-4 py-3 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="block w-full rounded bg-zinc-900 border border-zinc-800 text-white focus:border-orange-500 focus:ring-orange-500 sm:text-sm px-4 py-3 outline-none"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-orange-500 hover:bg-orange-600 text-zinc-950 font-bold py-2.5 px-6 rounded-lg text-sm transition disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <span className="material-symbols-outlined animate-spin text-[18px]">autorenew</span>}
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
