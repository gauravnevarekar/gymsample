import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

export default function AdminGymDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [gym, setGym] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    async function fetchGym() {
      try {
        const snap = await getDoc(doc(db, 'gyms', id));
        if (snap.exists()) {
          setGym({ id: snap.id, ...snap.data() });
        }
      } catch (err) {
        console.error("Error fetching gym:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchGym();
  }, [id]);

  if (loading) return <div className="text-zinc-500">Loading...</div>;
  if (!gym) return <div className="text-red-500">Gym not found</div>;

  const functions = getFunctions();

  async function handleResetPassword() {
    if(!window.confirm("Send password reset link to this gym owner?")) return;
    setActionLoading(true);
    try {
      const resetFn = httpsCallable(functions, 'resetGymPassword');
      const res = await resetFn({ email: gym.ownerEmail || gym.email });
      alert("Reset link generated: " + res.data.link);
    } catch (err) {
      alert("Failed: " + err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDisableToggle() {
    const isDisabling = gym.status !== 'disabled';
    if(!window.confirm(`Are you sure you want to ${isDisabling ? 'disable' : 'enable'} login for this gym?`)) return;
    setActionLoading(true);
    try {
      const disableFn = httpsCallable(functions, 'disableGym');
      await disableFn({ uid: id, disabled: isDisabling });
      setGym(prev => ({ ...prev, status: isDisabling ? 'disabled' : 'active' }));
    } catch (err) {
      alert("Failed: " + err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    if(!window.confirm("WARNING: This will permanently delete the gym user account. Are you sure?")) return;
    setActionLoading(true);
    try {
      const deleteFn = httpsCallable(functions, 'deleteGym');
      await deleteFn({ uid: id });
      alert("Gym deleted.");
      navigate('/admin/gyms');
    } catch (err) {
      alert("Failed: " + err.message);
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/admin/gyms')} className="text-zinc-400 hover:text-white flex items-center gap-2 text-sm">
        <span className="material-symbols-outlined text-sm">arrow_back</span> Back to Gyms
      </button>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">{gym.name}</h2>
              <p className="text-zinc-500 text-sm">Created: {new Date(gym.createdAt).toLocaleDateString()}</p>
            </div>
            <span className={`px-3 py-1 rounded text-xs uppercase font-bold tracking-wider ${
              gym.status === 'active' ? 'bg-green-500/10 text-green-500' :
              gym.status === 'disabled' ? 'bg-red-500/10 text-red-500' :
              'bg-yellow-500/10 text-yellow-500'
            }`}>
              {gym.status || 'active'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase text-zinc-500 tracking-wider">Owner Name</label>
              <div className="text-white font-medium">{gym.ownerName || '-'}</div>
            </div>
            <div>
              <label className="text-[10px] uppercase text-zinc-500 tracking-wider">Email</label>
              <div className="text-white font-medium">{gym.ownerEmail || gym.email || '-'}</div>
            </div>
            <div>
              <label className="text-[10px] uppercase text-zinc-500 tracking-wider">Phone</label>
              <div className="text-white font-medium">{gym.phone || '-'}</div>
            </div>
            <div>
              <label className="text-[10px] uppercase text-zinc-500 tracking-wider">Plan</label>
              <div className="text-white font-medium uppercase">{gym.plan || 'trial'}</div>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Danger Zone Actions</h3>
          <div className="space-y-3">
            <button 
              disabled={actionLoading}
              onClick={handleResetPassword}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-2 px-4 rounded text-sm text-left flex items-center gap-3 transition"
            >
              <span className="material-symbols-outlined text-lg">lock_reset</span>
              Generate Password Reset Link
            </button>
            <button 
              disabled={actionLoading}
              onClick={handleDisableToggle}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-2 px-4 rounded text-sm text-left flex items-center gap-3 transition"
            >
              <span className="material-symbols-outlined text-lg">{gym.status === 'disabled' ? 'play_arrow' : 'block'}</span>
              {gym.status === 'disabled' ? 'Enable Login' : 'Disable Login'}
            </button>
            <button 
              disabled={actionLoading}
              onClick={handleDelete}
              className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 py-2 px-4 rounded text-sm text-left flex items-center gap-3 transition"
            >
              <span className="material-symbols-outlined text-lg">delete_forever</span>
              Delete Gym Permanently
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
