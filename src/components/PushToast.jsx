import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { onMessage } from 'firebase/messaging';
import { motion, AnimatePresence } from 'framer-motion';
import { messagingPromise } from '../lib/firebase';

export default function PushToast() {
  const [notification, setNotification] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let unsubscribe = null;

    async function setupMessageListener() {
      const messaging = await messagingPromise;
      if (!messaging) return;

      unsubscribe = onMessage(messaging, (payload) => {
        console.log('[PushToast] Foreground message received: ', payload);
        
        const newNotif = {
          id: Date.now(),
          title: payload.notification?.title || 'GymFlow Alert',
          body: payload.notification?.body || 'You have a new update.',
          action: payload.data?.click_action || '/'
        };

        setNotification(newNotif);

        // Auto-dismiss after 6 seconds
        setTimeout(() => {
          setNotification((current) => (current?.id === newNotif.id ? null : current));
        }, 6000);
      });
    }

    setupMessageListener();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleClose = (e) => {
    e.stopPropagation();
    setNotification(null);
  };

  const handleClick = () => {
    if (notification?.action) {
      navigate(notification.action);
    }
    setNotification(null);
  };

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95, transition: { duration: 0.2 } }}
          onClick={handleClick}
          className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[9999] cursor-pointer"
        >
          <div className="bg-surface-container-highest/90 backdrop-blur-xl border border-primary/20 shadow-[0_10px_40px_rgba(0,0,0,0.5)] rounded-2xl p-4 flex gap-4 items-start relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
            
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary">notifications_active</span>
            </div>
            
            <div className="flex-1 min-w-0 pr-6">
              <h4 className="text-sm font-black text-white">{notification.title}</h4>
              <p className="text-xs text-zinc-400 mt-1 leading-snug">{notification.body}</p>
            </div>

            <button 
              onClick={handleClose}
              className="absolute top-2 right-2 p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
