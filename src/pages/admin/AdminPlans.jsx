import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function AdminPlans() {
  const [gyms, setGyms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'gyms'), (snapshot) => {
      const g = [];
      snapshot.forEach(doc => {
        if(doc.data().status !== 'deleted') {
          g.push({ id: doc.id, ...doc.data() });
        }
      });
      setGyms(g);
      setLoading(false);
    }, (err) => {
      console.error("Firestore error in AdminPlans:", err);
      setError("Failed to load plans: " + err.message);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const formatDate = (date) => {
    if (!date) return '';
    try {
      const d = date.toDate ? date.toDate() : new Date(date);
      if (isNaN(d.getTime())) return '';
      // Use local date parts to avoid the UTC one-day-off bug
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (e) {
      return '';
    }
  };

  const isDateExpired = (date) => {
    if (!date) return false;
    try {
      const d = date.toDate ? date.toDate() : new Date(date);
      return new Date() > d;
    } catch (e) {
      return false;
    }
  };

  async function updatePlan(id, newPlan) {
    try {
      await updateDoc(doc(db, 'gyms', id), { plan: newPlan });
    } catch (e) {
      alert("Failed: " + e.message);
    }
  }

  async function updateStatus(id, newStatus) {
    try {
      await updateDoc(doc(db, 'gyms', id), { status: newStatus });
    } catch (e) {
      alert("Failed: " + e.message);
    }
  }

  async function updateDate(id, field, dateString) {
    if(!dateString) return;
    try {
      // Use UTC constructor (YYYY-MM-DD) to avoid timezone shift during toISOString()
      const d = new Date(dateString);
      await updateDoc(doc(db, 'gyms', id), { [field]: d.toISOString() });
    } catch (e) {
      alert("Failed: " + e.message);
    }
  }

  async function extendExpiry(id, currentExpiry, days) {
    try {
      const baseDate = currentExpiry ? (currentExpiry.toDate ? currentExpiry.toDate() : new Date(currentExpiry)) : new Date();
      const newExpiry = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
      await updateDoc(doc(db, 'gyms', id), { 
        planExpiryDate: newExpiry.toISOString(),
        status: 'active' 
      });
    } catch (e) {
      alert("Failed: " + e.message);
    }
  }

  return (
    <div className="space-y-6 text-zinc-100">
      <div className="hidden md:block bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-zinc-950/50 text-zinc-400 uppercase text-xs">
            <tr>
              <th className="px-6 py-4 font-medium">Gym</th>
              <th className="px-6 py-4 font-medium">Current Plan</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Plan Dates</th>
              <th className="px-6 py-4 font-medium">Quick Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {loading ? (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center">
                  <div className="inline-block w-6 h-6 border-2 border-zinc-800 border-t-orange-500 rounded-full animate-spin"></div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center text-red-500 bg-red-500/5">{error}</td>
              </tr>
            ) : gyms.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center text-zinc-500">No gyms found.</td>
              </tr>
            ) : gyms.map(gym => {
              const isExpired = isDateExpired(gym.planExpiryDate);
              const effectiveStatus = gym.status === 'disabled' ? 'disabled' : (isExpired ? 'expired' : gym.status);
              const displayPlan = (gym.plan === 'pro' || gym.plan === 'premium') ? 'paid' : (gym.plan || 'trial');
              
              return (
              <tr key={gym.id} className="hover:bg-zinc-800/20">
                <td className="px-6 py-4">
                  <div className="font-bold flex items-center gap-2">
                    {gym.gymName || gym.name || 'Unnamed Gym'}
                    {isExpired && gym.status === 'active' && <span className="text-[9px] bg-yellow-500/10 text-yellow-500 px-1 rounded uppercase tracking-wider">Auto-Expired</span>}
                  </div>
                  <div className="text-zinc-500 text-xs">{gym.email || gym.ownerEmail || '-'}</div>
                </td>
                <td className="px-6 py-4">
                  <select 
                    value={displayPlan} 
                    onChange={(e) => updatePlan(gym.id, e.target.value)}
                    className="bg-zinc-800 border-none text-white rounded text-xs p-1 outline-none"
                  >
                    <option value="trial">Trial</option>
                    <option value="paid">Paid</option>
                  </select>
                </td>
                <td className="px-6 py-4">
                  <select 
                    value={gym.status || 'active'} 
                    onChange={(e) => updateStatus(gym.id, e.target.value)}
                    className={`border-none rounded text-xs p-1 outline-none ${
                      effectiveStatus === 'expired' ? 'bg-yellow-500/20 text-yellow-500' :
                      effectiveStatus === 'disabled' ? 'bg-red-500/20 text-red-500' :
                      'bg-zinc-800 text-white'
                    }`}
                  >
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </td>
                <td className="px-6 py-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-zinc-500 uppercase w-12">Start</label>
                    <input 
                      type="date" 
                      value={formatDate(gym.planStartDate)} 
                      onChange={(e) => updateDate(gym.id, 'planStartDate', e.target.value)}
                      className="bg-zinc-800 border-none text-white rounded text-xs p-1 outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-zinc-500 uppercase w-12">Expiry</label>
                    <input 
                      type="date" 
                      value={formatDate(gym.planExpiryDate)} 
                      onChange={(e) => updateDate(gym.id, 'planExpiryDate', e.target.value)}
                      className={`border-none rounded text-xs p-1 outline-none ${isExpired ? 'bg-red-500/20 text-red-500' : 'bg-zinc-800 text-white'}`}
                    />
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button onClick={() => extendExpiry(gym.id, gym.planExpiryDate, 30)} className="text-[10px] bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded">+1 Month</button>
                    <button onClick={() => updateStatus(gym.id, 'expired')} className="text-[10px] bg-red-500/10 text-red-500 hover:bg-red-500/20 px-2 py-1 rounded">Force Expire</button>
                  </div>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      <div className="space-y-4 md:hidden">
        {loading ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-12 text-center">
            <div className="inline-block w-6 h-6 border-2 border-zinc-800 border-t-orange-500 rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-4 text-sm text-red-400">{error}</div>
        ) : gyms.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-8 text-center text-zinc-500">No gyms found.</div>
        ) : (
          gyms.map((gym) => {
            const isExpired = isDateExpired(gym.planExpiryDate);
            const effectiveStatus = gym.status === 'disabled' ? 'disabled' : (isExpired ? 'expired' : gym.status);
            const displayPlan = (gym.plan === 'pro' || gym.plan === 'premium') ? 'paid' : (gym.plan || 'trial');

            return (
              <div key={gym.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words text-base font-bold text-white">{gym.gymName || gym.name || 'Unnamed Gym'}</h3>
                    <p className="mt-1 break-all text-xs text-zinc-500">{gym.email || gym.ownerEmail || '-'}</p>
                  </div>
                  <span className={`shrink-0 rounded px-2 py-1 text-[10px] uppercase font-bold tracking-wider ${
                    effectiveStatus === 'expired' ? 'bg-yellow-500/20 text-yellow-500' :
                    effectiveStatus === 'disabled' ? 'bg-red-500/20 text-red-500' :
                    'bg-green-500/10 text-green-500'
                  }`}>
                    {effectiveStatus || 'active'}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-widest text-zinc-500">Plan</label>
                    <select
                      value={displayPlan}
                      onChange={(e) => updatePlan(gym.id, e.target.value)}
                      className="w-full rounded-lg bg-zinc-800 p-2 text-sm text-white outline-none"
                    >
                      <option value="trial">Trial</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-widest text-zinc-500">Status</label>
                    <select
                      value={gym.status || 'active'}
                      onChange={(e) => updateStatus(gym.id, e.target.value)}
                      className={`w-full rounded-lg p-2 text-sm outline-none ${
                        effectiveStatus === 'expired' ? 'bg-yellow-500/20 text-yellow-500' :
                        effectiveStatus === 'disabled' ? 'bg-red-500/20 text-red-500' :
                        'bg-zinc-800 text-white'
                      }`}
                    >
                      <option value="active">Active</option>
                      <option value="expired">Expired</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-widest text-zinc-500">Start Date</label>
                    <input
                      type="date"
                      value={formatDate(gym.planStartDate)}
                      onChange={(e) => updateDate(gym.id, 'planStartDate', e.target.value)}
                      className="w-full rounded-lg bg-zinc-800 p-2 text-sm text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-widest text-zinc-500">Expiry Date</label>
                    <input
                      type="date"
                      value={formatDate(gym.planExpiryDate)}
                      onChange={(e) => updateDate(gym.id, 'planExpiryDate', e.target.value)}
                      className={`w-full rounded-lg p-2 text-sm outline-none ${isExpired ? 'bg-red-500/20 text-red-500' : 'bg-zinc-800 text-white'}`}
                    />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button onClick={() => extendExpiry(gym.id, gym.planExpiryDate, 30)} className="rounded-xl bg-zinc-800 px-3 py-3 text-xs font-medium text-white">
                    +1 Month
                  </button>
                  <button onClick={() => updateStatus(gym.id, 'expired')} className="rounded-xl bg-red-500/10 px-3 py-3 text-xs font-medium text-red-400">
                    Force Expire
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
