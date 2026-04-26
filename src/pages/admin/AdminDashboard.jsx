import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    trial: 0,
    expired: 0
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'gyms'), (snapshot) => {
      let total = 0, active = 0, trial = 0, expired = 0;
      
      snapshot.forEach((doc) => {
        total++;
        const data = doc.data();
        if (data.status === 'active') active++;
        if (data.status === 'expired' || data.status === 'disabled') expired++;
        if (data.plan === 'trial') trial++;
      });

      setStats({ total, active, trial, expired });
    });

    return unsubscribe;
  }, []);

  const cards = [
    { label: 'Total Gyms', value: stats.total, color: 'text-blue-500' },
    { label: 'Active Gyms', value: stats.active, color: 'text-green-500' },
    { label: 'Trial Gyms', value: stats.trial, color: 'text-yellow-500' },
    { label: 'Expired/Disabled', value: stats.expired, color: 'text-red-500' }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((c, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col justify-between h-32">
            <div className="text-zinc-400 text-sm font-medium uppercase tracking-wider">{c.label}</div>
            <div className={`text-4xl font-black ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>
      
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
        <span className="material-symbols-outlined text-4xl mb-2">insights</span>
        <p>Dashboard statistics updated in real-time.</p>
      </div>
    </div>
  );
}
