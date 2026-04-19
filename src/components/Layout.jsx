import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import clsx from 'clsx';
import { useState } from 'react';

export default function Layout() {
  const { logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function handleLogout() {
    try {
      await logout();
    } catch (e) {
      console.error(e);
    }
  }

  const navLinks = [
    { name: 'Dashboard', path: '/', icon: 'dashboard' },
    { name: 'Members', path: '/members', icon: 'group' },
    { name: 'Payments', path: '/payments', icon: 'payments' },
    { name: 'Expenses', path: '/expenses', icon: 'receipt_long' },
    { name: 'Settings', path: '/settings', icon: 'settings' },
  ];

  return (
    <div className="bg-surface text-on-surface selection:bg-primary selection:text-on-primary min-h-screen">
      {/* SideNavBar */}
      <aside className="hidden md:flex flex-col h-full w-72 fixed left-0 top-0 overflow-y-auto bg-zinc-950 z-50">
        <div className="flex flex-col h-full gap-2 py-8">
          <div className="px-8 mb-10">
            <div className="font-['Lexend'] font-black text-orange-500 text-xl tracking-widest">KINETIC</div>
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
            <button className="w-full py-4 bg-primary text-on-primary rounded-full font-bold flex items-center justify-center gap-2 shadow-lg hover:brightness-110 active:scale-95 transition-all">
              <span className="material-symbols-outlined">add</span>
              Add Member
            </button>
            <button onClick={handleLogout} className="text-zinc-500 hover:text-white transition-colors text-sm mt-4">
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* TopNavBar */}
      <header className="fixed top-0 right-0 left-0 md:left-72 z-40 bg-zinc-950/70 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
        <div className="flex justify-between items-center w-full px-6 py-4">
          <div className="flex items-center gap-4">
            <span className="md:hidden font-['Lexend'] text-2xl font-black italic tracking-tighter text-orange-500">KINETIC</span>
            <div className="relative hidden sm:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">search</span>
              <input className="bg-zinc-900 border-none rounded-full pl-10 pr-4 py-2 text-sm w-64 focus:ring-1 focus:ring-orange-500 transition-all text-white" placeholder="Search members..." type="text" />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <button className="relative text-zinc-400 hover:text-orange-500 transition-colors">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full"></span>
            </button>
            <div className="flex items-center gap-3 pl-6 border-l border-zinc-800">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-on-surface">Gym Admin</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-700 text-white">
                <span className="material-symbols-outlined">person</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Canvas */}
      <main className="md:ml-72 pt-24 pb-20 px-6 lg:px-10 min-h-screen">
        <Outlet />
      </main>

      {/* Bottom Navigation for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-nav z-50 flex items-center justify-around py-3 px-2 border-t border-zinc-800/50">
        {navLinks.filter(l => l.name !== 'Settings').map(link => (
          <Link
            key={link.name}
            to={link.path}
            className={clsx(
              "flex flex-col items-center gap-1",
              location.pathname === link.path ? "text-orange-500" : "text-zinc-500"
            )}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: location.pathname === link.path ? "'FILL' 1" : undefined }}>{link.icon}</span>
            <span className="text-[10px] font-bold uppercase tracking-tighter">{link.name}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
