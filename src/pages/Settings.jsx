import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';

export default function Settings() {
  const { currentUser, logout } = useAuth();
  const [gymName, setGymName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadGymSettings() {
      if (!currentUser) return;
      try {
        setLoading(true);
        const gymRef = doc(db, 'gyms', currentUser.uid);
        const gymSnap = await getDoc(gymRef);
        if (gymSnap.exists()) {
          setGymName(gymSnap.data().name || 'GYMFLOW');
        } else {
          setGymName('GYMFLOW');
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load gym settings.');
      } finally {
        setLoading(false);
      }
    }
    loadGymSettings();
  }, [currentUser]);

  async function handleSave(e) {
    e.preventDefault();
    if (!currentUser) return;
    try {
      setSaving(true);
      setError('');
      setMessage('');
      await updateDoc(doc(db, 'gyms', currentUser.uid), {
        name: gymName.trim() || 'GYMFLOW'
      });
      setMessage('Settings updated successfully.');
    } catch (err) {
      console.error(err);
      setError('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    try {
      await logout();
    } catch (err) {
      console.error(err);
      setError('Failed to log out.');
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="mb-8 md:mb-10">
        <h1 className="text-3xl md:text-4xl font-black headline-font italic uppercase tracking-tighter text-on-surface">Settings</h1>
        <p className="text-zinc-500 font-medium mt-1">Manage your gym profile and account access</p>
      </div>

      <div className="max-w-2xl">
        <section className="bg-surface-container-low/50 backdrop-blur-xl rounded-2xl border border-outline-variant/10 shadow-2xl p-6 md:p-8">
          
          {loading ? (
            <p className="text-sm text-zinc-500">Loading settings...</p>
          ) : (
            <div className="space-y-8">
              {/* Profile Form */}
              <form onSubmit={handleSave} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Gym Name</label>
                  <input
                    value={gymName}
                    onChange={(e) => setGymName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all"
                    placeholder="Enter gym name"
                  />
                </div>

                <div className="rounded-xl border border-white/5 bg-zinc-950/60 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Owner Email</p>
                  <p className="text-sm text-white mt-2 break-all">{currentUser?.email || '-'}</p>
                </div>

                {message && <div className="rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">{message}</div>}
                {error && <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">{error}</div>}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full sm:w-auto bg-primary hover:bg-primary-dim disabled:opacity-60 text-zinc-950 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-sm shadow-[0_0_20px_rgba(253,139,0,0.2)] transition-all"
                  >
                    {saving ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </form>

              <hr className="border-white/5" />

              {/* Log Out */}
              <div>
                <button
                  onClick={handleLogout}
                  className="w-full rounded-xl border border-error/20 bg-error/10 px-5 py-4 text-sm font-black uppercase tracking-widest text-error hover:bg-error hover:text-zinc-950 transition-all flex justify-between items-center"
                >
                  Log Out
                  <span className="material-symbols-outlined">logout</span>
                </button>
              </div>

            </div>
          )}
        </section>
      </div>
    </motion.div>
  );
}
