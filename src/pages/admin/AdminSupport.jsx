import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, app } from '../../lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

export default function AdminSupport() {
  const [gyms, setGyms] = useState([]);
  const [search, setSearch] = useState('');
  const [loadingId, setLoadingId] = useState(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'gyms'), (snapshot) => {
      const g = [];
      snapshot.forEach(doc => g.push({ id: doc.id, ...doc.data() }));
      setGyms(g);
    });
    return unsubscribe;
  }, []);

  const filteredGyms = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    if (!searchTerm) return gyms;

    return gyms.filter(g => {
      return (
        (g.gymName?.toLowerCase() || "").includes(searchTerm) || 
        (g.name?.toLowerCase() || "").includes(searchTerm) || 
        (g.ownerName?.toLowerCase() || "").includes(searchTerm) ||
        (g.email?.toLowerCase() || "").includes(searchTerm) ||
        (g.ownerEmail?.toLowerCase() || "").includes(searchTerm)
      );
    });
  }, [gyms, search]);

  async function handleResetPassword(gymId) {
    if(!window.confirm("Send standard password reset link to this gym owner's email?")) return;
    setLoadingId(gymId + '_reset');
    try {
      const functions = getFunctions(app, 'us-central1');
      const resetFn = httpsCallable(functions, 'resetGymPassword');
      const res = await resetFn({ uid: gymId });
      alert("Reset link generated: " + res.data.link);
    } catch (err) {
      alert("Failed: " + err.message);
    } finally {
      setLoadingId(null);
    }
  }

  async function handleForceReset(gymId) {
    if(!window.confirm("EMERGENCY FORCE RESET: This will instantly change the user's password, bypassing their email. The user will be forced to change it upon next login. Are you absolutely sure?")) return;
    setLoadingId(gymId + '_force');
    try {
      const functions = getFunctions(app, 'us-central1');
      const forceResetFn = httpsCallable(functions, 'forceResetGymPassword');
      const res = await forceResetFn({ uid: gymId });
      
      const { tempPassword, authEmail } = res.data;
      
      // Use prompt so the admin can easily copy it
      window.prompt(
        `SUCCESS! Password forcefully reset for ${authEmail}.\n\n` + 
        `Share this temporary password with the gym owner securely. They will be forced to change it on login.\n\n` +
        `Copy the temporary password below:`, 
        tempPassword
      );

    } catch (err) {
      alert("Force Reset Failed: " + err.message);
    } finally {
      setLoadingId(null);
    }
  }

  async function handleDisableToggle(gymId, currentStatus) {
    const isDisabling = currentStatus !== 'disabled';
    if(!window.confirm(`Are you sure you want to ${isDisabling ? 'disable' : 'enable'} this gym?`)) return;
    setLoadingId(gymId);
    try {
      const functions = getFunctions(app, 'us-central1');
      const disableFn = httpsCallable(functions, 'disableGym');
      await disableFn({ uid: gymId, disabled: isDisabling });
    } catch (err) {
      alert("Failed: " + err.message);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-6 text-zinc-100 max-w-4xl">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-xl font-bold mb-4">Support Tools</h2>
        <div className="relative mb-6">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">search</span>
          <input 
            type="text" 
            placeholder="Search gym by name or email..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded p-3 pl-10 w-full text-white outline-none focus:border-orange-500 transition"
          />
        </div>

        {search.trim().length > 0 && (
          <div className="space-y-4">
            {filteredGyms.map(gym => (
              <div key={gym.id} className="bg-zinc-950 border border-zinc-800 p-4 rounded-lg flex items-center justify-between">
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    {gym.gymName || gym.name || 'Unnamed Gym'}
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${
                      gym.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                    }`}>{gym.status || 'active'}</span>
                  </div>
                  <div className="text-zinc-500 text-sm mt-1">
                    {gym.ownerName ? `${gym.ownerName} • ` : ''}
                    {gym.email || gym.ownerEmail || 'No email provided'}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  <button 
                    disabled={loadingId === gym.id + '_reset'}
                    onClick={() => handleResetPassword(gym.id)}
                    className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded text-xs font-medium flex items-center gap-2 disabled:opacity-50"
                    title="Send password reset email"
                  >
                    <span className="material-symbols-outlined text-[16px]">mail</span> 
                    {loadingId === gym.id + '_reset' ? 'Sending...' : 'Reset Email'}
                  </button>
                  <button 
                    disabled={loadingId === gym.id + '_force'}
                    onClick={() => handleForceReset(gym.id)}
                    className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 px-3 py-1.5 rounded text-xs font-medium flex items-center gap-2 disabled:opacity-50"
                    title="Force reset password instantly (no email needed)"
                  >
                    <span className="material-symbols-outlined text-[16px]">warning</span> 
                    {loadingId === gym.id + '_force' ? 'Forcing...' : 'Force Reset'}
                  </button>
                  <button 
                    disabled={loadingId === gym.id}
                    onClick={() => handleDisableToggle(gym.id, gym.status)}
                    className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded text-xs font-medium flex items-center gap-2 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[16px]">{gym.status === 'disabled' ? 'play_arrow' : 'block'}</span> 
                    {loadingId === gym.id ? 'Processing...' : (gym.status === 'disabled' ? 'Enable' : 'Disable')}
                  </button>
                </div>
              </div>
            ))}
            {filteredGyms.length === 0 && (
              <div className="text-center text-zinc-500 py-4">No gyms found.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
