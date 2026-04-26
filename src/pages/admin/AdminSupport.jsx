import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
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

  const filteredGyms = gyms.filter(g => 
    g.name?.toLowerCase().includes(search.toLowerCase()) || 
    g.ownerEmail?.toLowerCase().includes(search.toLowerCase())
  );

  async function handleResetPassword(email) {
    if(!window.confirm("Send password reset link?")) return;
    try {
      const functions = getFunctions();
      const resetFn = httpsCallable(functions, 'resetGymPassword');
      const res = await resetFn({ email });
      alert("Reset link generated: " + res.data.link);
    } catch (err) {
      alert("Failed: " + err.message);
    }
  }

  async function handleDisableToggle(gymId, currentStatus) {
    const isDisabling = currentStatus !== 'disabled';
    if(!window.confirm(`Are you sure you want to ${isDisabling ? 'disable' : 'enable'} this gym?`)) return;
    setLoadingId(gymId);
    try {
      const functions = getFunctions();
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

        {search.length > 0 && (
          <div className="space-y-4">
            {filteredGyms.map(gym => (
              <div key={gym.id} className="bg-zinc-950 border border-zinc-800 p-4 rounded-lg flex items-center justify-between">
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    {gym.name}
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${
                      gym.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                    }`}>{gym.status || 'active'}</span>
                  </div>
                  <div className="text-zinc-500 text-sm mt-1">{gym.ownerEmail}</div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleResetPassword(gym.ownerEmail || gym.email)}
                    className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded text-xs font-medium flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[16px]">lock_reset</span> Reset Password
                  </button>
                  <button 
                    disabled={loadingId === gym.id}
                    onClick={() => handleDisableToggle(gym.id, gym.status)}
                    className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded text-xs font-medium flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[16px]">{gym.status === 'disabled' ? 'play_arrow' : 'block'}</span> 
                    {gym.status === 'disabled' ? 'Enable' : 'Disable'}
                  </button>
                </div>
              </div>
            ))}
            {filteredGyms.length === 0 && (
              <div className="text-center text-zinc-500 py-4">No results found.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
