import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';

export default function Payments() {
  const { currentUser } = useAuth();
  const [payments, setPayments] = useState([]);
  const [members, setMembers] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPayment, setNewPayment] = useState({ memberId: '', amount: '', method: 'Cash', plan_type: 'Standard' });

  useEffect(() => {
    if (!currentUser) return;
    
    // Fetch payments
    const paymentsRef = collection(db, 'gyms', currentUser.uid, 'payments');
    const unsubscribePayments = onSnapshot(paymentsRef, (snapshot) => {
      const list = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      list.sort((a,b) => new Date(b.date) - new Date(a.date));
      setPayments(list);
    });

    // Fetch members for dropdown
    const membersRef = collection(db, 'gyms', currentUser.uid, 'members');
    const unsubscribeMembers = onSnapshot(membersRef, (snapshot) => {
      const mList = [];
      snapshot.forEach(doc => mList.push({ id: doc.id, name: doc.data().name, expiry_date: doc.data().expiry_date }));
      setMembers(mList);
    });

    return () => { unsubscribePayments(); unsubscribeMembers(); }
  }, [currentUser]);

  const handleAddPayment = async (e) => {
    e.preventDefault();
    try {
      const member = members.find(m => m.id === newPayment.memberId);
      if (!member) return;

      // 1. Log Payment
      await addDoc(collection(db, 'gyms', currentUser.uid, 'payments'), {
        memberId: member.id,
        member_name: member.name,
        amount: Number(newPayment.amount),
        method: newPayment.method,
        plan_type: newPayment.plan_type,
        date: new Date().toISOString()
      });

      // 2. Extend Expiry (+30 days logic)
      let currentExp = new Date(member.expiry_date);
      const now = new Date();
      if (currentExp < now) currentExp = now; // If expired, start from today
      currentExp.setDate(currentExp.getDate() + 30);
      
      await updateDoc(doc(db, 'gyms', currentUser.uid, 'members', member.id), {
        expiry_date: currentExp.toISOString().split('T')[0]
      });

      setShowAddModal(false);
      setNewPayment({ memberId: '', amount: '', method: 'Cash', plan_type: 'Standard' });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-4xl font-black headline-font uppercase italic tracking-tighter text-white">Payments</h1>
          <p className="text-zinc-500 font-medium text-sm mt-1">Record incoming revenues</p>
        </div>
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAddModal(true)}
          className="bg-primary hover:bg-primary-dim text-on-primary px-6 py-3 rounded-xl font-bold shadow-[0_0_15px_rgba(253,139,0,0.3)] transition-colors flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">add</span> Receive Payment
        </motion.button>
      </div>

      <div className="bg-surface-container-low/50 backdrop-blur-xl rounded-2xl border border-outline-variant/10 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container/50 border-b border-outline-variant/10">
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">Date</th>
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">Member</th>
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">Plan</th>
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none text-center">Method</th>
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {payments.length === 0 ? (
                <tr><td colSpan="5" className="py-12 text-center text-zinc-500 font-medium">No payments found.</td></tr>
              ) : (
                <AnimatePresence>
                  {payments.map(p => (
                    <motion.tr 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      key={p.id} 
                      className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-4 px-6 text-sm font-medium text-zinc-400">{new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      <td className="py-4 px-6 font-bold text-white">{p.member_name}</td>
                      <td className="py-4 px-6 text-xs font-bold text-zinc-400"><span className="border border-white/10 px-2 py-1 rounded bg-black/20">{p.plan_type}</span></td>
                      <td className="py-4 px-6 text-center">
                        <span className="bg-tertiary/10 border border-tertiary/20 text-tertiary px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest">{p.method}</span>
                      </td>
                      <td className="py-4 px-6 text-sm font-black text-primary text-right">+₹{p.amount.toFixed(2)}</td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showAddModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-surface-container-highest p-8 rounded-2xl w-full max-w-md border border-white/5 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3">
                <button onClick={() => setShowAddModal(false)} className="text-zinc-500 hover:text-white"><span className="material-symbols-outlined">close</span></button>
              </div>

              <h2 className="text-2xl font-black headline-font italic mb-6 text-white uppercase">Record Payment</h2>
              
              <form onSubmit={handleAddPayment} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Select Member</label>
                  <select required value={newPayment.memberId} onChange={e => setNewPayment({...newPayment, memberId: e.target.value})} className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all">
                    <option value="" disabled>Choose a member...</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Amount Given (₹)</label>
                  <input type="number" required value={newPayment.amount} onChange={e => setNewPayment({...newPayment, amount: e.target.value})} className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Payment Method</label>
                  <select value={newPayment.method} onChange={e => setNewPayment({...newPayment, method: e.target.value})} className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all">
                    <option>Cash</option>
                    <option>UPI</option>
                    <option>Card</option>
                  </select>
                </div>
                <div className="pt-4 pb-2">
                  <button type="submit" className="w-full py-4 bg-primary text-zinc-950 font-black uppercase tracking-widest text-sm rounded-xl hover:bg-primary-dim shadow-[0_0_20px_rgba(253,139,0,0.2)] transition-all">
                    Confirm Registration
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
