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

  return (
    <div className="space-y-6 text-zinc-100">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-zinc-950/50 text-zinc-400 uppercase text-xs">
            <tr>
              <th className="px-6 py-4 font-medium">Gym</th>
              <th className="px-6 py-4 font-medium">Current Plan</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Quick Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {gyms.map(gym => (
              <tr key={gym.id} className="hover:bg-zinc-800/20">
                <td className="px-6 py-4">
                  <div className="font-bold">{gym.name}</div>
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
                    className="bg-zinc-800 border-none text-white rounded text-xs p-1 outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button onClick={() => updatePlan(gym.id, 'trial')} className="text-[10px] bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded">Extend Trial</button>
                    <button onClick={() => updateStatus(gym.id, 'expired')} className="text-[10px] bg-red-500/10 text-red-500 hover:bg-red-500/20 px-2 py-1 rounded">Mark Expired</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
