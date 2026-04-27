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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'gyms'), (snapshot) => {
      let total = 0, active = 0, trial = 0, expired = 0;
      
      console.log("Dashboard Snapshot size:", snapshot.size);
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status === 'deleted') return;

        total++;
        const isExpired = data.planExpiryDate && (data.planExpiryDate.toDate ? data.planExpiryDate.toDate() : new Date(data.planExpiryDate)) < new Date();
        
        if (data.status === 'active' && !isExpired) active++;
        if (data.status === 'expired' || data.status === 'disabled' || (data.status === 'active' && isExpired)) expired++;
        if (data.plan === 'trial') trial++;
      });
      
      console.log("Calculated stats:", { total, active, trial, expired });
      setStats({ total, active, trial, expired });
      setLoading(false);
    }, (err) => {
      console.error("Firestore error in AdminDashboard:", err);
      setError("Permission denied. Ensure rules are deployed and session is refreshed.");
      setLoading(false);
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
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-xl flex items-center gap-3">
          <span className="material-symbols-outlined">error</span>
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 md:gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 md:p-6 h-32 animate-pulse flex flex-col justify-between">
              <div className="h-4 bg-zinc-800 rounded w-24"></div>
              <div className="h-10 bg-zinc-800 rounded w-16"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 md:gap-6">
          {cards.map((c, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 md:p-6 flex flex-col justify-between h-32">
              <div className="text-zinc-400 text-xs sm:text-sm font-medium uppercase tracking-wider">{c.label}</div>
              <div className={`text-3xl sm:text-4xl font-black ${c.color}`}>{c.value}</div>
            </div>
          ))}
        </div>
      )}
      
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 md:p-8 text-center text-zinc-500">
        <span className="material-symbols-outlined text-4xl mb-2">insights</span>
        <p>Dashboard statistics updated in real-time.</p>
      </div>
    </div>
  );
}
