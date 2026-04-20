import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export default function Notifications() {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!currentUser) return;

    const membersRef = collection(db, 'gyms', currentUser.uid, 'members');
    const unsubscribe = onSnapshot(membersRef, (snapshot) => {
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const items = [];
      snapshot.forEach((memberDoc) => {
        const data = memberDoc.data();
        const expiryDate = new Date(data.expiry_date);
        expiryDate.setHours(0, 0, 0, 0);

        const diffTime = expiryDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 3) {
          items.push({
            id: memberDoc.id,
            memberName: data.name,
            phone: data.phone || '-',
            expiryDate: data.expiry_date,
            diffDays,
            type: diffDays < 0 ? 'expired' : 'expiring'
          });
        }
      });

      items.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
      setNotifications(items);
    });

    return unsubscribe;
  }, [currentUser]);

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
          <h2 className="text-xl md:text-2xl font-black headline-font text-white mt-2">{notifications.length} Active Notifications</h2>
        </div>

        {notifications.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-white font-bold">No active notifications</p>
            <p className="text-sm text-zinc-500 mt-2">All members are active for more than 3 days.</p>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/5">
            {notifications.map((item) => {
              const isExpired = item.type === 'expired';

              return (
                <div key={item.id} className="px-4 py-4 md:px-6 md:py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:bg-zinc-800/20 transition-colors">
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

                  <Link
                    to="/members"
                    className="inline-flex items-center justify-center rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/5 transition-colors"
                  >
                    View Member List
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
