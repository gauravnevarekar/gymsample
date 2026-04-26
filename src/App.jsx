import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Members from './pages/Members';
import Payments from './pages/Payments';
import Expenses from './pages/Expenses';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminGyms from './pages/admin/AdminGyms';
import AdminGymDetails from './pages/admin/AdminGymDetails';
import AdminPlans from './pages/admin/AdminPlans';
import AdminSupport from './pages/admin/AdminSupport';

export default function App() {
  const { currentUser, userRole } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={
        !currentUser ? <Login /> : (userRole === 'super_admin' ? <Navigate to="/admin" replace /> : <Navigate to="/" replace />)
      } />
      
      {/* Gym Owner Routes */}
      <Route element={<ProtectedRoute allowedRole="gym_owner" />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/members" element={<Members />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>

      {/* Super Admin Routes */}
      <Route path="/admin" element={<ProtectedRoute allowedRole="super_admin" />}>
        <Route element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="gyms" element={<AdminGyms />} />
          <Route path="gyms/:id" element={<AdminGymDetails />} />
          <Route path="plans" element={<AdminPlans />} />
          <Route path="support" element={<AdminSupport />} />
          <Route path="settings" element={<div className="p-8 text-white">Admin Settings</div>} />
        </Route>
      </Route>

      <Route path="*" element={currentUser ? (userRole === 'super_admin' ? <Navigate to="/admin" replace /> : <Navigate to="/" replace />) : <Navigate to="/login" replace />} />
    </Routes>
  );
}
