import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function AdminPlans() {
  const [gyms, setGyms] = useState([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'gyms'), (snapshot) => {
      const g = [];
      snapshot.forEach(doc => {
        if(doc.data().status !== 'deleted') {
          g.push({ id: doc.id, ...doc.data() });
        }
      });
      setGyms(g);
    });
    return unsubscribe;
  }, []);

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
      // Set time to midnight local to avoid timezone shifting issues when picking a date
      const d = new Date(dateString + 'T00:00:00');
      await updateDoc(doc(db, 'gyms', id), { [field]: d.toISOString() });
    } catch (e) {
      alert("Failed: " + e.message);
    }
  }

  async function extendExpiry(id, currentExpiry, days) {
    try {
      const baseDate = currentExpiry ? new Date(currentExpiry) : new Date();
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
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
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
            {gyms.map(gym => {
              const isExpired = gym.planExpiryDate && new Date() > new Date(gym.planExpiryDate);
              const effectiveStatus = gym.status === 'disabled' ? 'disabled' : (isExpired ? 'expired' : gym.status);
              
              return (
              <tr key={gym.id} className="hover:bg-zinc-800/20">
                <td className="px-6 py-4">
                  <div className="font-bold flex items-center gap-2">
                    {gym.name}
                    {isExpired && gym.status === 'active' && <span className="text-[9px] bg-yellow-500/10 text-yellow-500 px-1 rounded uppercase tracking-wider">Auto-Expired</span>}
                  </div>
                  <div className="text-zinc-500 text-xs">{gym.ownerEmail}</div>
                </td>
                <td className="px-6 py-4">
                  <select 
                    value={gym.plan || 'trial'} 
                    onChange={(e) => updatePlan(gym.id, e.target.value)}
                    className="bg-zinc-800 border-none text-white rounded text-xs p-1 outline-none"
                  >
                    <option value="trial">Trial</option>
                    <option value="pro">Pro</option>
                    <option value="premium">Premium</option>
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
                      value={gym.planStartDate ? gym.planStartDate.split('T')[0] : ''} 
                      onChange={(e) => updateDate(gym.id, 'planStartDate', e.target.value)}
                      className="bg-zinc-800 border-none text-white rounded text-xs p-1 outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-zinc-500 uppercase w-12">Expiry</label>
                    <input 
                      type="date" 
                      value={gym.planExpiryDate ? gym.planExpiryDate.split('T')[0] : ''} 
                      onChange={(e) => updateDate(gym.id, 'planExpiryDate', e.target.value)}
                      className={`border-none rounded text-xs p-1 outline-none ${isExpired ? 'bg-red-500/20 text-red-500' : 'bg-zinc-800 text-white'}`}
                    />
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button onClick={() => extendExpiry(gym.id, gym.planExpiryDate, 14)} className="text-[10px] bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded">+14 Days</button>
                    <button onClick={() => extendExpiry(gym.id, gym.planExpiryDate, 30)} className="text-[10px] bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded">+1 Month</button>
                    <button onClick={() => updateStatus(gym.id, 'expired')} className="text-[10px] bg-red-500/10 text-red-500 hover:bg-red-500/20 px-2 py-1 rounded">Force Expire</button>
                  </div>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );
}
