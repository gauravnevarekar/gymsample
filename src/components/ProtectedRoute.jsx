import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ allowedRole }) {
  const { currentUser, userRole, gymStatus, planExpiryDate, logout } = useAuth();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Handle case where userRole might not be loaded yet or doesn't match
  if (userRole && userRole !== allowedRole) {
    if (userRole === 'super_admin') {
      return <Navigate to="/admin" replace />;
    } else {
      return <Navigate to="/" replace />;
    }
  }

  // Intercept gym owner based on status
  if (allowedRole === 'gym_owner' && userRole === 'gym_owner') {
    const now = new Date();
    const expiry = planExpiryDate ? new Date(planExpiryDate) : null;
    const isExpiredByDate = expiry && now > expiry;
    
    // Status 'disabled' supersedes date expiry. Otherwise, date expiry supersedes 'active'/'trial'.
    const effectiveStatus = gymStatus === 'disabled' ? 'disabled' : (isExpiredByDate ? 'expired' : gymStatus);

    if (effectiveStatus === 'expired') {
      return (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 text-center">
          <span className="material-symbols-outlined text-yellow-500 text-6xl mb-4">warning</span>
          <h1 className="text-2xl font-bold text-white mb-2 uppercase tracking-widest">Subscription Expired</h1>
          <p className="text-zinc-400 mb-8 max-w-md">Your trial or subscription has expired. Please contact the administrator to renew your plan and regain access to your dashboard.</p>
          <button onClick={() => logout()} className="px-8 py-3 bg-zinc-800 text-white rounded-full text-sm font-bold tracking-wider hover:bg-zinc-700 transition">SIGN OUT</button>
        </div>
      );
    }
    
    if (effectiveStatus === 'disabled') {
      return (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 text-center">
          <span className="material-symbols-outlined text-red-500 text-6xl mb-4">block</span>
          <h1 className="text-2xl font-bold text-white mb-2 uppercase tracking-widest">Account Disabled</h1>
          <p className="text-zinc-400 mb-8 max-w-md">Your account has been restricted by the administrator. Please contact support for more information regarding your account status.</p>
          <button onClick={() => logout()} className="px-8 py-3 bg-zinc-800 text-white rounded-full text-sm font-bold tracking-wider hover:bg-zinc-700 transition">SIGN OUT</button>
        </div>
      );
    }
  }

  return <Outlet />;
}
