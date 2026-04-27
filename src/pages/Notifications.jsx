import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import Avatar from '../components/Avatar';

export default function Notifications() {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState([]);

  const [dismissedIds, setDismissedIds] = useState([]);
  const [members, setMembers] = useState([]);

  useEffect(() => {
    if (!currentUser) return;
    const stored = JSON.parse(localStorage.getItem(`readNotifs_${currentUser.uid}`) || '[]');
    setDismissedIds(stored);

    const fetchNotifications = async () => {
      try {
        const membersRef = collection(db, 'gyms', currentUser.uid, 'members');
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        
        // Fetch only members expiring soon or expired within the last 60 days
        const pastDate = new Date(now);
        pastDate.setDate(pastDate.getDate() - 60);
        
        const futureDate = new Date(now);
        futureDate.setDate(futureDate.getDate() + 3);

        const q = query(membersRef, 
          where('expiry_date', '>=', pastDate.toISOString()),
          where('expiry_date', '<=', futureDate.toISOString())
        );

        const snapshot = await getDocs(q);
        const mList = [];
        snapshot.forEach(doc => mList.push({ id: doc.id, ...doc.data() }));
        setMembers(mList);
      } catch (err) {
        console.error("Failed to load notifications", err);
      }
    };

    fetchNotifications();
  }, [currentUser]);

  const handleDismiss = (notifId) => {
    const updated = [...dismissedIds, notifId];
    setDismissedIds(updated);
    localStorage.setItem(`readNotifs_${currentUser.uid}`, JSON.stringify(updated));
    window.dispatchEvent(new Event('notificationsRead'));
  };

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const activeNotifications = members.map(data => {
    const expiryDate = new Date(data.expiry_date);
    expiryDate.setHours(0, 0, 0, 0);
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 3) {
      const notifId = `${data.id}_${data.expiry_date}`;
      if (dismissedIds.includes(notifId)) return null;

      return {
        id: data.id,
        notifId,
        memberName: data.name,
        phone: data.phone || '-',
        expiryDate: data.expiry_date,
        diffDays,
        type: diffDays < 0 ? 'expired' : 'expiring',
        photoURL: data.photoURL || ''
      };
    }
    return null;
  }).filter(Boolean).sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));


  function formatMessage(item) {
    if (item.type === 'expired') {
      const daysOverdue = Math.abs(item.diffDays);
      return daysOverdue === 1 ? 'Expired yesterday' : `Expired ${daysOverdue} days ago`;
    }

    if (item.diffDays === 0) return 'Expires today';
    if (item.diffDays === 1) return 'Expires tomorrow';
    return `Expires in ${item.diffDays} days`;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="mb-8 md:mb-10">
        <h1 className="text-3xl md:text-4xl font-black headline-font italic uppercase tracking-tighter text-on-surface">Notifications</h1>
        <p className="text-zinc-500 font-medium mt-1">Expiring and expired members that need follow-up</p>
      </div>

      <div className="bg-surface-container-low/50 backdrop-blur-xl rounded-2xl border border-outline-variant/10 shadow-2xl overflow-hidden">
        <div className="border-b border-outline-variant/10 bg-surface-container/50 px-4 py-4 md:px-6 md:py-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Alerts</p>
          <h2 className="text-xl md:text-2xl font-black headline-font text-white mt-2">{activeNotifications.length} Active Notifications</h2>
        </div>

        {activeNotifications.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-white font-bold">No active notifications</p>
            <p className="text-sm text-zinc-500 mt-2">All members are updated or handled.</p>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/5">
            {activeNotifications.map((item) => {
              const isExpired = item.type === 'expired';

              return (
                <div key={item.notifId} className="px-4 py-4 md:px-6 md:py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:bg-zinc-800/20 transition-colors">
                  <div className="flex items-center gap-4">
                    <Avatar photoURL={item.photoURL} name={item.memberName} size="md" />
                    <div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <p className="text-white font-bold text-lg">{item.memberName}</p>
                      <span className={`px-2.5 py-1 rounded border text-[10px] font-black uppercase tracking-wider ${
                        isExpired
                           ? 'text-error bg-error/10 border-error/20'
                           : 'text-primary bg-primary/10 border-primary/20'
                       }`}>
                        {isExpired ? 'Expired' : 'Expiring Soon'}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-400 mt-2">{formatMessage(item)}</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      Phone: {item.phone} | Expiry: {new Date(item.expiryDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDismiss(item.notifId)}
                    className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-500 hover:bg-green-500 hover:text-zinc-950 transition-all flex items-center gap-2 font-bold text-sm"
                    title="Mark as Done"
                  >
                    <span className="material-symbols-outlined">check_circle</span>
                    <span className="hidden sm:inline">Done</span>
                  </button>
                  <Link
                      to="/members"
                      className="inline-flex items-center justify-center rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/5 transition-colors"
                    >
                      View Member List
                    </Link>
                </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
