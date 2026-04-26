import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import clsx from 'clsx';

export default function AdminLayout() {
  const { logout } = useAuth();
  const location = useLocation();

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

  return (
    <div className="bg-zinc-950 text-white min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800 flex flex-col h-screen sticky top-0 bg-zinc-950">
        <div className="p-6">
          <div className="text-orange-500 font-black tracking-widest text-xl">SUPER ADMIN</div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Platform Control</div>
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

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden">
        <header className="h-16 border-b border-zinc-800 flex items-center px-8 bg-zinc-950 sticky top-0 z-10">
          <h1 className="text-lg font-bold text-zinc-200">
            {navLinks.find(l => l.path === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(l.path))?.name || 'Admin'}
          </h1>
        </header>
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
