import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Link } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';

export default function AdminGyms() {
  const [gyms, setGyms] = useState([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // New gym form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

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

  async function handleCreateGym(e) {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const functions = getFunctions();
      const createGym = httpsCallable(functions, 'createGym');
      await createGym({ email, password, name });
      setIsModalOpen(false);
      setName(''); setEmail(''); setPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDisableToggle(gymId, currentStatus) {
    if(!window.confirm(`Are you sure you want to ${currentStatus === 'disabled' ? 'enable' : 'disable'} this gym?`)) return;
    try {
      const functions = getFunctions();
      const disableGym = httpsCallable(functions, 'disableGym');
      await disableGym({ uid: gymId, disabled: currentStatus !== 'disabled' });
    } catch (err) {
      alert("Failed to toggle status: " + err.message);
    }
  }

  return (
    <div className="space-y-6 text-zinc-100">
      <div className="flex justify-between items-center">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">search</span>
          <input 
            type="text" 
            placeholder="Search gyms..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-full pl-10 pr-4 py-2 text-sm w-64 focus:border-orange-500 outline-none"
          />
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-orange-500 text-zinc-950 font-bold px-4 py-2 rounded-full text-sm hover:bg-orange-600 transition">
          + Create Gym
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-zinc-950/50 text-zinc-400 uppercase text-xs">
            <tr>
              <th className="px-6 py-4 font-medium">Gym Name</th>
              <th className="px-6 py-4 font-medium">Owner</th>
              <th className="px-6 py-4 font-medium">Plan</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {filteredGyms.map(gym => (
              <tr key={gym.id} className="hover:bg-zinc-800/20 transition-colors">
                <td className="px-6 py-4 font-medium">{gym.name}</td>
                <td className="px-6 py-4">
                  <div>{gym.ownerName || '-'}</div>
                  <div className="text-zinc-500 text-xs">{gym.ownerEmail || gym.email || '-'}</div>
                </td>
                <td className="px-6 py-4">
                  <span className="uppercase text-[10px] tracking-wider font-bold bg-zinc-800 px-2 py-1 rounded">
                    {gym.plan || 'trial'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider ${
                    gym.status === 'active' ? 'bg-green-500/10 text-green-500' :
                    gym.status === 'disabled' ? 'bg-red-500/10 text-red-500' :
                    'bg-yellow-500/10 text-yellow-500'
                  }`}>
                    {gym.status || 'active'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => handleDisableToggle(gym.id, gym.status)} className="text-zinc-400 hover:text-white p-1">
                      <span className="material-symbols-outlined text-sm">{gym.status === 'disabled' ? 'play_arrow' : 'block'}</span>
                    </button>
                    <Link to={`/admin/gyms/${gym.id}`} className="text-orange-500 hover:text-orange-400 font-medium p-1">
                      Details
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {filteredGyms.length === 0 && (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-zinc-500">No gyms found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Create New Gym</h2>
            <form onSubmit={handleCreateGym} className="space-y-4">
              {error && <div className="text-red-500 text-sm bg-red-500/10 p-3 rounded">{error}</div>}
              <div>
                <label className="block text-xs uppercase text-zinc-400 mb-1">Gym Name</label>
                <input required value={name} onChange={e=>setName(e.target.value)} type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-xs uppercase text-zinc-400 mb-1">Owner Email</label>
                <input required value={email} onChange={e=>setEmail(e.target.value)} type="email" className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-xs uppercase text-zinc-400 mb-1">Temporary Password</label>
                <input required value={password} onChange={e=>setPassword(e.target.value)} type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white outline-none focus:border-orange-500" />
              </div>
              <div className="flex gap-3 justify-end mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-white">Cancel</button>
                <button type="submit" disabled={creating} className="px-4 py-2 text-sm bg-orange-500 text-zinc-950 font-bold rounded hover:bg-orange-600 disabled:opacity-50">
                  {creating ? 'Creating...' : 'Create Gym'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
