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
    address: '',
    plan: 'trial',
    status: 'active',
    planStartDate: '',
    planExpiryDate: ''
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'gyms'), (snapshot) => {
      const g = [];
      snapshot.forEach(doc => {
        if (doc.data().status !== 'deleted') {
          g.push({ id: doc.id, ...doc.data() });
        }
      });
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

  const formatLocalDate = (date) => {
    if (!date) return '';
    try {
      const d = date.toDate ? date.toDate() : new Date(date);
      if (isNaN(d.getTime())) return '';
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (e) {
      return '';
    }
  };

  function openCreateModal() {
    setEditingGym(null);
    setError('');
    const now = new Date();
    setFormData({
      uid: '',
      gymName: '',
      ownerName: '',
      email: '',
      phone: '',
      address: '',
      plan: 'trial',
      status: 'active',
      planStartDate: formatLocalDate(now),
      planExpiryDate: ''
    });
    setIsModalOpen(true);
  }

  function openEditModal(gym) {
    setEditingGym(gym);
    setError('');
    
    setFormData({
      uid: gym.id,
      gymName: gym.gymName || gym.name || '',
      ownerName: gym.ownerName || '',
      email: gym.email || '',
      phone: gym.phone || '',
      address: gym.address || '',
      plan: gym.plan || 'trial',
      status: gym.status || 'active',
      planStartDate: formatLocalDate(gym.planStartDate),
      planExpiryDate: formatLocalDate(gym.planExpiryDate)
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
      if (!formData.planStartDate) throw new Error("Plan Start Date is required.");
      if (!formData.planExpiryDate) throw new Error("Plan Expiry Date is required.");
      
      const startDate = new Date(formData.planStartDate);
      const expiryDate = new Date(formData.planExpiryDate);

      const gymData = {
        gymName: formData.gymName,
        ownerName: formData.ownerName,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">search</span>
          <input 
            type="text" 
            placeholder="Search gyms..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full min-w-0 bg-zinc-900 border border-zinc-800 rounded-full pl-10 pr-4 py-2 text-sm sm:w-64 focus:border-orange-500 outline-none"
          />
        </div>
        <button onClick={openCreateModal} className="w-full sm:w-auto bg-orange-500 text-zinc-950 font-bold px-4 py-2 rounded-full text-sm hover:bg-orange-600 transition">
          + Configure New Gym
        </button>
      </div>

      <div className="hidden md:block bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
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

      <div className="space-y-4 md:hidden">
        {loading ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-12 text-center">
            <div className="inline-block w-6 h-6 border-2 border-zinc-800 border-t-orange-500 rounded-full animate-spin"></div>
          </div>
        ) : filteredGyms.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-8 text-center text-zinc-500">No gyms found.</div>
        ) : (
          filteredGyms.map((gym) => (
            <div key={gym.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-lg">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words text-base font-bold text-white">{gym.gymName || gym.name || 'Unnamed Gym'}</h3>
                  <p className="mt-1 break-all text-xs text-zinc-500">{gym.email || '-'}</p>
                  <p className="mt-1 text-sm text-zinc-300">{gym.ownerName || '-'}</p>
                </div>
                <span className={`shrink-0 rounded px-2 py-1 text-[10px] uppercase font-bold tracking-wider ${
                  gym.status === 'active' ? 'bg-green-500/10 text-green-500' :
                  gym.status === 'disabled' ? 'bg-red-500/10 text-red-500' :
                  'bg-yellow-500/10 text-yellow-500'
                }`}>
                  {gym.status || 'active'}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-3">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500">Plan</p>
                  <p className="mt-1 text-sm font-bold uppercase text-white">
                    {(gym.plan === 'pro' || gym.plan === 'premium') ? 'paid' : (gym.plan || 'trial')}
                  </p>
                </div>
                <button
                  onClick={() => handleDisableToggle(gym.id, gym.status)}
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200"
                >
                  {gym.status === 'disabled' ? 'Enable' : 'Disable'}
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={() => openEditModal(gym)} className="rounded-xl bg-blue-500/10 px-3 py-3 text-sm font-medium text-blue-400">
                  Edit
                </button>
                <Link to={`/admin/gyms/${gym.id}`} className="rounded-xl bg-orange-500/10 px-3 py-3 text-center text-sm font-medium text-orange-400">
                  Details
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl p-4 sm:p-6 my-8">
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
                  <input
                    type="tel"
                    maxLength="10"
                    value={formData.phone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setFormData({ ...formData, phone: val });
                    }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white outline-none focus:border-orange-500"
                    placeholder="10-digit number"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs uppercase text-zinc-400 mb-1">Address</label>
                  <input value={formData.address} onChange={e=>setFormData({...formData, address: e.target.value})} type="text" placeholder="Gym Location / Address" className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white outline-none focus:border-orange-500" />
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

              <div className="mt-6 flex flex-col-reverse gap-3 border-t border-zinc-800 pt-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto px-4 py-2 text-sm text-zinc-400 hover:text-white">Cancel</button>
                <button type="submit" disabled={saving} className="w-full sm:w-auto px-4 py-2 text-sm bg-orange-500 text-zinc-950 font-bold rounded hover:bg-orange-600 disabled:opacity-50">
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
