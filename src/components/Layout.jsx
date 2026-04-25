import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import PushToast from './PushToast';

export default function Layout() {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [notificationCount, setNotificationCount] = useState(0);
  const [memberSearch, setMemberSearch] = useState('');

  async function handleLogout() {
    try {
      await logout();
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    if (!currentUser) return;

    const membersRef = collection(db, 'gyms', currentUser.uid, 'members');
    const unsubscribe = onSnapshot(membersRef, (snapshot) => {
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      let count = 0;
      snapshot.forEach((memberDoc) => {
        const data = memberDoc.data();
        const expiryDate = new Date(data.expiry_date);
        expiryDate.setHours(0, 0, 0, 0);

        const diffTime = expiryDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 3) {
          count += 1;
        }
      });

      setNotificationCount(count);
    });

    return unsubscribe;
  }, [currentUser]);

  const navLinks = [
    { name: 'Dashboard', path: '/', icon: 'dashboard' },
    { name: 'Members', path: '/members', icon: 'group' },
    { name: 'Payments', path: '/payments', icon: 'payments' },
    { name: 'Expenses', path: '/expenses', icon: 'receipt_long' },
    { name: 'Settings', path: '/settings', icon: 'settings' },
  ];

  function handleSearchChange(e) {
    const value = e.target.value;
    setMemberSearch(value);

    if (location.pathname !== '/members') {
      navigate('/members');
    }
  }

  return (
    <div className="bg-surface text-on-surface selection:bg-primary selection:text-on-primary min-h-screen overflow-x-hidden">
      <PushToast />
      
      {/* SideNavBar */}
      <aside className="hidden md:flex flex-col h-full w-72 fixed left-0 top-0 overflow-y-auto bg-zinc-950 z-50">
        <div className="flex flex-col h-full gap-2 py-8">
          <div className="px-8 mb-10">
            <div className="font-['Lexend'] font-black text-orange-500 text-xl tracking-widest">GYMFLOW</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] mt-1 font-medium">Precision Management</div>
          </div>
          <nav className="flex-1 flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className={clsx(
                  "py-3 px-8 transition-colors flex items-center gap-4 group",
                  location.pathname === link.path
                    ? "bg-gradient-to-r from-orange-500 to-orange-600 text-zinc-950 rounded-r-full shadow-lg shadow-orange-500/20 font-bold"
                    : "text-zinc-500 hover:text-zinc-100 hover:bg-zinc-900"
                )}
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: location.pathname === link.path ? "'FILL' 1" : undefined }}>
                  {link.icon}
                </span>
                <span>{link.name}</span>
              </Link>
            ))}
          </nav>
          <div className="px-6 mt-auto flex flex-col gap-2">
            <button onClick={handleLogout} className="text-zinc-500 hover:text-white transition-colors text-sm mt-4">
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* TopNavBar */}
      <header className="fixed top-0 right-0 left-0 md:left-72 z-40 bg-zinc-950/70 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] pt-safe-top">
        <div className="flex justify-between items-center w-full gap-3 px-3 py-3 sm:px-4 md:px-6 md:py-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="md:hidden font-['Lexend'] text-xl sm:text-2xl font-black italic tracking-tighter text-orange-500 truncate">GYMFLOW</span>
            <div className="relative hidden md:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">search</span>
              <input
                value={memberSearch}
                onChange={handleSearchChange}
                className="bg-zinc-900 border-none rounded-full pl-10 pr-4 py-2 text-sm w-64 focus:ring-1 focus:ring-orange-500 transition-all text-white"
                placeholder="Search members..."
                type="text"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 md:gap-6">
            <Link
              to="/notifications"
              className={clsx(
                "relative transition-colors shrink-0",
                location.pathname === '/notifications' ? "text-orange-500" : "text-zinc-400 hover:text-orange-500"
              )}
            >
              <span className="material-symbols-outlined">notifications</span>
              {notificationCount > 0 && (
                <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-orange-500 text-zinc-950 text-[10px] font-black flex items-center justify-center">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </Link>
            <Link
              to="/settings"
              className="flex items-center gap-2 pl-3 sm:pl-4 md:pl-6 border-l border-zinc-800 min-w-0"
            >
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-on-surface">Gym Admin</p>
                <p className="text-[10px] uppercase tracking-widest text-zinc-500">Settings</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-700 text-white">
                <span className="material-symbols-outlined">person</span>
              </div>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Canvas */}
      <main className="md:ml-72 pt-20 md:pt-24 pb-28 md:pb-20 px-3 sm:px-4 md:px-6 lg:px-10 min-h-screen">
        <Outlet context={{ memberSearch, setMemberSearch }} />
      </main>

      {/* Bottom Navigation for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-nav z-50 grid grid-cols-5 items-center px-1 border-t border-zinc-800/50 pt-3 pb-safe-bottom min-h-[72px]">
        {navLinks.map((link) => (
          <Link
            key={link.name}
            to={link.path}
            className={clsx(
              "flex min-w-0 flex-col items-center gap-1 px-1 text-center",
              location.pathname === link.path ? "text-orange-500" : "text-zinc-500"
            )}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: location.pathname === link.path ? "'FILL' 1" : undefined }}>{link.icon}</span>
            <span className="text-[9px] font-bold uppercase tracking-tight leading-none">{link.name}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
