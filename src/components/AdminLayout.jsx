import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import clsx from 'clsx';
import { useState } from 'react';

export default function AdminLayout() {
  const { logout } = useAuth();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  async function handleLogout() {
    try {
      await logout();
    } catch (e) {
      console.error(e);
    }
  }

  const navLinks = [
    { name: 'Dashboard', path: '/admin', icon: 'dashboard' },
    { name: 'Gyms', path: '/admin/gyms', icon: 'fitness_center' },
    { name: 'Plans', path: '/admin/plans', icon: 'card_membership' },
    { name: 'Support', path: '/admin/support', icon: 'support_agent' },
    { name: 'Settings', path: '/admin/settings', icon: 'settings' },
  ];

  const currentLabel = navLinks.find((link) =>
    link.path === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(link.path)
  )?.name || 'Admin';

  function closeMobileNav() {
    setMobileNavOpen(false);
  }

  return (
    <div className="bg-zinc-950 text-white min-h-screen md:flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-zinc-800 flex-col h-screen sticky top-0 bg-zinc-950">
        <div className="p-6">
          <Link to="/admin" className="flex items-center gap-3">
            <img src="/logo.png" alt="GymFlow Logo" className="h-12 w-auto" />
            <div>
              <div className="text-orange-500 font-black tracking-widest text-xl leading-none">ADMIN</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1 leading-none">Platform Control</div>
            </div>
          </Link>
        </div>
        
        <nav className="flex-1 flex flex-col gap-1 px-4 mt-6">
          {navLinks.map((link) => {
            // Precise active matching for Dashboard vs other nested routes
            const isActive = link.path === '/admin' 
              ? location.pathname === '/admin' 
              : location.pathname.startsWith(link.path);

            return (
              <Link
                key={link.name}
                to={link.path}
                className={clsx(
                  "py-3 px-4 rounded-lg flex items-center gap-3 transition-colors text-sm font-medium",
                  isActive
                    ? "bg-orange-500 text-zinc-950"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                )}
              >
                <span className="material-symbols-outlined text-lg">{link.icon}</span>
                {link.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-6">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 text-zinc-400 hover:text-white transition-colors text-sm font-medium"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
            Logout
          </button>
        </div>
      </aside>

      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={closeMobileNav}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <aside className="relative z-10 flex h-full w-[85vw] max-w-xs flex-col border-r border-zinc-800 bg-zinc-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 p-5">
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="GymFlow Logo" className="h-10 w-auto" />
                <div>
                  <div className="text-orange-500 font-black tracking-widest text-lg leading-none">ADMIN</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1 leading-none">Platform Control</div>
                </div>
              </div>
              <button onClick={closeMobileNav} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-900 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <nav className="flex-1 space-y-1 px-4 py-5">
              {navLinks.map((link) => {
                const isActive = link.path === '/admin'
                  ? location.pathname === '/admin'
                  : location.pathname.startsWith(link.path);

                return (
                  <Link
                    key={link.name}
                    to={link.path}
                    onClick={closeMobileNav}
                    className={clsx(
                      "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-orange-500 text-zinc-950"
                        : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                    )}
                  >
                    <span className="material-symbols-outlined text-lg">{link.icon}</span>
                    {link.name}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-zinc-800 p-4">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-white"
              >
                <span className="material-symbols-outlined text-lg">logout</span>
                Logout
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 sm:px-6 md:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="md:hidden rounded-lg p-2 text-zinc-400 hover:bg-zinc-900 hover:text-white"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div>
              <p className="md:hidden text-[10px] uppercase tracking-[0.24em] text-zinc-500">Super Admin</p>
              <h1 className="text-base font-bold text-zinc-200 md:text-lg">{currentLabel}</h1>
            </div>
          </div>
          <div className="md:hidden text-[11px] font-bold uppercase tracking-[0.2em] text-orange-500">Gymflow</div>
        </header>
        <div className="px-4 py-5 pb-24 sm:px-6 md:p-8 md:pb-8">
          <Outlet />
        </div>
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 grid min-h-[72px] grid-cols-5 items-center border-t border-zinc-800/70 bg-zinc-950/90 px-1 pb-safe-bottom pt-3 backdrop-blur-xl">
        {navLinks.map((link) => {
          const isActive = link.path === '/admin'
            ? location.pathname === '/admin'
            : location.pathname.startsWith(link.path);

          return (
            <Link
              key={link.name}
              to={link.path}
              className={clsx(
                "flex min-w-0 flex-col items-center gap-1 px-1 text-center",
                isActive ? "text-orange-500" : "text-zinc-500"
              )}
            >
              <span className="material-symbols-outlined">{link.icon}</span>
              <span className="text-[9px] font-bold uppercase leading-none tracking-tight">{link.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
