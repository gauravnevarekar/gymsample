import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';

export default function Members() {
  const { currentUser } = useAuth();
  const [members, setMembers] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Create or Edit state
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', phone: '', plan: 'Standard', expiry_date: '' });

  useEffect(() => {
    if (!currentUser) return;
    const membersRef = collection(db, 'gyms', currentUser.uid, 'members');
    const unsubscribe = onSnapshot(membersRef, (snapshot) => {
      const list = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      // Sort by expiry
      list.sort((a,b) => new Date(a.expiry_date) - new Date(b.expiry_date));
      setMembers(list);
    });
    return unsubscribe;
  }, [currentUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        // Edit mode
        await updateDoc(doc(db, 'gyms', currentUser.uid, 'members', editingId), {
          name: formData.name,
          phone: formData.phone,
          plan: formData.plan,
          expiry_date: formData.expiry_date
        });
      } else {
        // Add mode
        await addDoc(collection(db, 'gyms', currentUser.uid, 'members'), {
          ...formData,
          join_date: new Date().toISOString()
        });
      }
      closeModal();
    } catch (err) {
      console.error(err);
    }
  };

  const openEdit = (member) => {
    setEditingId(member.id);
    setFormData({
      name: member.name,
      phone: member.phone || '',
      plan: member.plan,
      expiry_date: member.expiry_date
    });
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingId(null);
    setFormData({ name: '', phone: '', plan: 'Standard', expiry_date: '' });
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this member?")) {
      await deleteDoc(doc(db, 'gyms', currentUser.uid, 'members', id));
    }
  };

  const getStatus = (expiryDate) => {
    const now = new Date();
    const exp = new Date(expiryDate);
    return exp >= now 
      ? { label: 'Active', color: 'text-primary bg-primary/10 border-primary/20' } 
      : { label: 'Expired', color: 'text-error bg-error/10 border-error/20' };
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-4xl font-black headline-font italic uppercase tracking-tighter text-on-surface">Member Directory</h1>
          <p className="text-zinc-500 font-medium mt-1">Manage operations and members</p>
        </div>
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAddModal(true)}
          className="bg-primary hover:bg-primary-dim text-on-primary px-6 py-3 rounded-xl font-bold shadow-[0_0_15px_rgba(253,139,0,0.3)] transition-colors flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">add</span>
          Add Member
        </motion.button>
      </div>

      <div className="bg-surface-container-low/50 backdrop-blur-xl rounded-2xl border border-outline-variant/10 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container/50 border-b border-outline-variant/10">
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">Member</th>
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">Phone</th>
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">Plan</th>
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none text-center">Status</th>
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">Expiry</th>
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {members.length === 0 ? (
                <tr><td colSpan="6" className="py-12 text-center text-sm font-medium text-zinc-500">No members registered yet.</td></tr>
              ) : (
                <AnimatePresence>
                  {members.map(m => {
                    const status = getStatus(m.expiry_date);
                    return (
                      <motion.tr 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, x: -20 }}
                        key={m.id} 
                        className="hover:bg-zinc-800/30 transition-colors group cursor-default">
                        <td className="py-4 px-6 font-medium text-white">{m.name}</td>
                        <td className="py-4 px-6 text-sm text-zinc-400">{m.phone}</td>
                        <td className="py-4 px-6 text-sm font-bold text-zinc-300">{m.plan}</td>
                        <td className="py-4 px-6 text-center">
                          <span className={`px-2.5 py-1 rounded border text-[10px] font-black uppercase tracking-wider ${status.color}`}>{status.label}</span>
                        </td>
                        <td className="py-4 px-6 text-sm font-medium text-zinc-400">{new Date(m.expiry_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric'})}</td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex gap-3 justify-end items-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(m)} className="text-zinc-400 hover:text-white transition-colors text-xs font-bold flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">edit</span> Edit</button>
                            <button onClick={() => handleDelete(m.id)} className="text-error/70 hover:text-error transition-colors text-xs font-bold flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">delete</span> Delete</button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-surface-container-highest p-8 rounded-2xl w-full max-w-md border border-white/5 shadow-2xl relative overflow-hidden">
              
              <div className="absolute top-0 right-0 p-3">
                <button onClick={closeModal} className="text-zinc-500 hover:text-white"><span className="material-symbols-outlined">close</span></button>
              </div>

              <h2 className="text-2xl font-black headline-font italic mb-6 text-white uppercase">{editingId ? 'Edit Member' : 'Add New Member'}</h2>
              
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Full Name</label>
                  <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Phone Number</label>
                  <input required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Membership Plan</label>
                    <input required value={formData.plan} onChange={e => setFormData({...formData, plan: e.target.value})} className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Expiry Date</label>
                    <input type="date" required value={formData.expiry_date} onChange={e => setFormData({...formData, expiry_date: e.target.value})} className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all" />
                  </div>
                </div>
                
                <div className="pt-4 pb-2">
                  <button type="submit" className="w-full py-4 bg-primary text-zinc-950 font-black uppercase tracking-widest text-sm rounded-xl hover:bg-primary-dim shadow-[0_0_20px_rgba(253,139,0,0.2)] transition-all">
                    {editingId ? 'Save Changes' : 'Confirm Member'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
