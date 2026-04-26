import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db, app } from '../../lib/firebase';
import { Link } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';

export default function AdminGyms() {
  const [gyms, setGyms] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGym, setEditingGym] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    uid: '',
    gymName: '',
    ownerName: '',
    email: '',
    phone: '',
    plan: 'trial',
    status: 'active',
    planStartDate: '',
    planExpiryDate: ''
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'gyms'), (snapshot) => {
      const g = [];
      snapshot.forEach(doc => g.push({ id: doc.id, ...doc.data() }));
      setGyms(g);
      setLoading(false);
    }, (err) => {
      console.error("Firestore error in AdminGyms:", err);
      setError("Failed to load gyms: " + err.message);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const filteredGyms = gyms.filter(g => {
    const searchTerm = search.toLowerCase();
    return (
      (g.gymName?.toLowerCase() || "").includes(searchTerm) || 
      (g.email?.toLowerCase() || "").includes(searchTerm) ||
      (g.ownerName?.toLowerCase() || "").includes(searchTerm)
    );
  });

  function openCreateModal() {
    setEditingGym(null);
    setError('');
    const now = new Date();
    const expiry = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    setFormData({
      uid: '',
      gymName: '',
      ownerName: '',
      email: '',
      phone: '',
      plan: 'trial',
      status: 'active',
      planStartDate: now.toISOString().split('T')[0],
      planExpiryDate: expiry.toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  }

  function openEditModal(gym) {
    setEditingGym(gym);
    setError('');
    
    // Safely parse existing dates
    let startDate = '';
    let expiryDate = '';
    
    if (gym.planStartDate) {
      const d = gym.planStartDate.toDate ? gym.planStartDate.toDate() : new Date(gym.planStartDate);
      if (!isNaN(d)) startDate = d.toISOString().split('T')[0];
    }
    if (gym.planExpiryDate) {
      const d = gym.planExpiryDate.toDate ? gym.planExpiryDate.toDate() : new Date(gym.planExpiryDate);
      if (!isNaN(d)) expiryDate = d.toISOString().split('T')[0];
    }

    setFormData({
      uid: gym.id,
      gymName: gym.gymName || gym.name || '',
      ownerName: gym.ownerName || '',
      email: gym.email || '',
      phone: gym.phone || '',
      plan: gym.plan || 'trial',
      status: gym.status || 'active',
      planStartDate: startDate,
      planExpiryDate: expiryDate
    });
    setIsModalOpen(true);
  }

  async function handleSaveGym(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    
    try {
      const targetUid = editingGym ? editingGym.id : formData.uid.trim();
      if (!targetUid) throw new Error("Firebase Auth UID is required.");

      // Prepare dates
      const startDate = formData.planStartDate ? new Date(formData.planStartDate) : new Date();
      const expiryDate = formData.planExpiryDate ? new Date(formData.planExpiryDate) : new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000);

      const gymData = {
        gymName: formData.gymName,
        ownerName: formData.ownerName,
        email: formData.email,
        phone: formData.phone,
        plan: formData.plan,
        status: formData.status,
        planStartDate: startDate,
        planExpiryDate: expiryDate,
        updatedAt: new Date()
      };

      if (!editingGym) {
        gymData.createdAt = new Date();
      }

      // Write directly to Firestore using Client SDK
      await setDoc(doc(db, 'gyms', targetUid), gymData, { merge: true });
      await setDoc(doc(db, 'users', targetUid), {
        email: formData.email,
        gymId: targetUid,
        role: "gym_owner"
      }, { merge: true });

      setIsModalOpen(false);
    } catch (err) {
      console.error("Error saving gym:", err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDisableToggle(gymId, currentStatus) {
    if(!window.confirm(`Are you sure you want to ${currentStatus === 'disabled' ? 'enable' : 'disable'} this gym?`)) return;
    try {
      const functions = getFunctions(app, 'us-central1');
      const disableGym = httpsCallable(functions, 'disableGym');
      await disableGym({ uid: gymId, disabled: currentStatus !== 'disabled' });
    } catch (err) {
      alert("Failed to toggle status: " + err.message);
    }
  }

  return (
    <div className="space-y-6 text-zinc-100">
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-xl flex items-center gap-3">
          <span className="material-symbols-outlined">error</span>
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}
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
        <button onClick={openCreateModal} className="bg-orange-500 text-zinc-950 font-bold px-4 py-2 rounded-full text-sm hover:bg-orange-600 transition">
          + Configure New Gym
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
                <td className="px-6 py-4 font-medium">{gym.gymName || gym.name || 'Unnamed Gym'}</td>
                <td className="px-6 py-4">
                  <div>{gym.ownerName || '-'}</div>
                  <div className="text-zinc-500 text-xs">{gym.email || '-'}</div>
                </td>
                <td className="px-6 py-4">
                  <span className="uppercase text-[10px] tracking-wider font-bold bg-zinc-800 px-2 py-1 rounded">
                    {(gym.plan === 'pro' || gym.plan === 'premium') ? 'paid' : (gym.plan || 'trial')}
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
                  <div className="flex justify-end items-center gap-2">
                    <button onClick={() => handleDisableToggle(gym.id, gym.status)} title={gym.status === 'disabled' ? 'Enable Gym' : 'Disable Gym'} className="text-zinc-400 hover:text-white p-1">
                      <span className="material-symbols-outlined text-sm">{gym.status === 'disabled' ? 'play_arrow' : 'block'}</span>
                    </button>
                    <button onClick={() => openEditModal(gym)} className="text-blue-500 hover:text-blue-400 font-medium p-1 ml-2">
                      Edit
                    </button>
                    <Link to={`/admin/gyms/${gym.id}`} className="text-orange-500 hover:text-orange-400 font-medium p-1">
                      Details
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {loading ? (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center">
                  <div className="inline-block w-6 h-6 border-2 border-zinc-800 border-t-orange-500 rounded-full animate-spin"></div>
                </td>
              </tr>
            ) : filteredGyms.length === 0 && (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-zinc-500">No gyms found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl p-6 my-8">
            <h2 className="text-xl font-bold mb-4">{editingGym ? 'Edit Gym Profile' : 'Configure New Gym'}</h2>
            
            {!editingGym && (
              <div className="mb-6 bg-orange-500/10 border border-orange-500/30 p-4 rounded-lg">
                <p className="text-sm text-orange-200">
                  <strong className="text-orange-500 block mb-1">Important:</strong> 
                  Ensure you have already created the user account in the Firebase Authentication console. 
                  Paste their exact UID below to link this profile to their account.
                </p>
              </div>
            )}

            <form onSubmit={handleSaveGym} className="space-y-4">
              {error && <div className="text-red-500 text-sm bg-red-500/10 p-3 rounded">{error}</div>}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {!editingGym && (
                  <div className="md:col-span-2">
                    <label className="block text-xs uppercase text-zinc-400 mb-1">Firebase Auth UID *</label>
                    <input required value={formData.uid} onChange={e=>setFormData({...formData, uid: e.target.value})} type="text" placeholder="e.g. jB2x8V..." className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white outline-none focus:border-orange-500" />
                  </div>
                )}
                
                <div>
                  <label className="block text-xs uppercase text-zinc-400 mb-1">Gym Name *</label>
                  <input required value={formData.gymName} onChange={e=>setFormData({...formData, gymName: e.target.value})} type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white outline-none focus:border-orange-500" />
                </div>
                
                <div>
                  <label className="block text-xs uppercase text-zinc-400 mb-1">Owner Name *</label>
                  <input required value={formData.ownerName} onChange={e=>setFormData({...formData, ownerName: e.target.value})} type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white outline-none focus:border-orange-500" />
                </div>

                <div>
                  <label className="block text-xs uppercase text-zinc-400 mb-1">Owner Email *</label>
                  <input required value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} type="email" className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white outline-none focus:border-orange-500" />
                </div>

                <div>
                  <label className="block text-xs uppercase text-zinc-400 mb-1">Phone</label>
                  <input value={formData.phone} onChange={e=>setFormData({...formData, phone: e.target.value})} type="tel" className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white outline-none focus:border-orange-500" />
                </div>

                <div>
                  <label className="block text-xs uppercase text-zinc-400 mb-1">Plan</label>
                  <select value={formData.plan} onChange={e=>setFormData({...formData, plan: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white outline-none focus:border-orange-500">
                    <option value="trial">Trial</option>
                    <option value="pro">Pro</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase text-zinc-400 mb-1">Status</label>
                  <select value={formData.status} onChange={e=>setFormData({...formData, status: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white outline-none focus:border-orange-500">
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase text-zinc-400 mb-1">Plan Start Date</label>
                  <input type="date" value={formData.planStartDate} onChange={e=>setFormData({...formData, planStartDate: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white outline-none focus:border-orange-500 [color-scheme:dark]" />
                </div>

                <div>
                  <label className="block text-xs uppercase text-zinc-400 mb-1">Plan Expiry Date</label>
                  <input type="date" value={formData.planExpiryDate} onChange={e=>setFormData({...formData, planExpiryDate: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white outline-none focus:border-orange-500 [color-scheme:dark]" />
                </div>
              </div>

              <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-zinc-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-white">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-orange-500 text-zinc-950 font-bold rounded hover:bg-orange-600 disabled:opacity-50">
                  {saving ? 'Saving...' : (editingGym ? 'Save Changes' : 'Configure Gym')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
