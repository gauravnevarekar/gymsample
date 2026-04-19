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
  const [newPayment, setNewPayment] = useState({ memberId: '', amount: '', method: 'Cash' });

  useEffect(() => {
    if (!currentUser) return;

    const paymentsRef = collection(db, 'gyms', currentUser.uid, 'payments');
    const unsubscribePayments = onSnapshot(paymentsRef, (snapshot) => {
      const list = [];
      snapshot.forEach((paymentDoc) => {
        list.push({ id: paymentDoc.id, ...paymentDoc.data() });
      });
      list.sort((a, b) => new Date(b.date) - new Date(a.date));
      setPayments(list);
    });

    const membersRef = collection(db, 'gyms', currentUser.uid, 'members');
    const unsubscribeMembers = onSnapshot(membersRef, (snapshot) => {
      const mList = [];
      snapshot.forEach((memberDoc) => {
        const data = memberDoc.data();
        mList.push({
          id: memberDoc.id,
          name: data.name,
          expiry_date: data.expiry_date,
          planType: data.planType || data.plan || 'Monthly',
          planDuration: Number(data.planDuration || 30),
          planPrice: data.planPrice || ''
        });
      });
      setMembers(mList);
    });

    return () => {
      unsubscribePayments();
      unsubscribeMembers();
    };
  }, [currentUser]);

  const selectedMember = members.find((member) => member.id === newPayment.memberId);

  const handleAddPayment = async (e) => {
    e.preventDefault();
    try {
      const member = members.find((m) => m.id === newPayment.memberId);
      if (!member) return;

      await addDoc(collection(db, 'gyms', currentUser.uid, 'payments'), {
        memberId: member.id,
        member_name: member.name,
        amount: Number(newPayment.amount),
        method: newPayment.method,
        plan_type: member.planType,
        date: new Date().toISOString()
      });

      let currentExp = new Date(member.expiry_date);
      const now = new Date();
      if (currentExp < now) currentExp = now;
      currentExp.setDate(currentExp.getDate() + Number(member.planDuration || 30));

      await updateDoc(doc(db, 'gyms', currentUser.uid, 'members', member.id), {
        expiry_date: currentExp.toISOString().split('T')[0]
      });

      setShowAddModal(false);
      setNewPayment({ memberId: '', amount: '', method: 'Cash' });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 md:mb-10 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black headline-font uppercase italic tracking-tighter text-white">Payments</h1>
          <p className="text-sm md:text-base text-zinc-500 font-medium mt-1">Record incoming revenues</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAddModal(true)}
          className="w-full md:w-auto bg-primary hover:bg-primary-dim text-on-primary px-6 py-3.5 md:py-3 rounded-xl font-bold shadow-[0_0_15px_rgba(253,139,0,0.3)] transition-colors flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">add</span> Receive Payment
        </motion.button>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-surface-container-low/50 backdrop-blur-xl rounded-2xl border border-outline-variant/10 shadow-2xl overflow-hidden">
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
                  {payments.map((p) => (
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      key={p.id}
                      className="hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="py-4 px-6 text-sm font-medium text-zinc-400">{new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      <td className="py-4 px-6 font-bold text-white">{p.member_name}</td>
                      <td className="py-4 px-6 text-xs font-bold text-zinc-400"><span className="border border-white/10 px-2 py-1 rounded bg-black/20">{p.plan_type}</span></td>
                      <td className="py-4 px-6 text-center">
                        <span className="bg-tertiary/10 border border-tertiary/20 text-tertiary px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest">{p.method}</span>
                      </td>
                      <td className="py-4 px-6 text-sm font-black text-primary text-right">+Rs {p.amount.toFixed(2)}</td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {payments.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 font-medium">No payments found.</div>
        ) : (
          <AnimatePresence>
            {payments.map((p) => (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                key={p.id}
                className="bg-surface-container-low/50 backdrop-blur-xl rounded-2xl border border-outline-variant/10 p-5 shadow-lg flex flex-col gap-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-black text-white">{p.member_name}</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">{new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                  <span className="text-primary font-black text-lg">+₹{p.amount.toFixed(2)}</span>
                </div>
                
                <div className="flex items-center gap-2 mt-2">
                  <span className="bg-white/10 border border-white/20 text-white px-2 py-1 rounded text-[10px] font-bold tracking-wider">{p.plan_type}</span>
                  <span className="bg-tertiary/10 border border-tertiary/20 text-tertiary px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest">{p.method}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-surface-container-highest p-6 md:p-8 rounded-2xl w-full max-w-md border border-white/5 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-3">
                <button onClick={() => setShowAddModal(false)} className="text-zinc-500 hover:text-white p-2 flex"><span className="material-symbols-outlined">close</span></button>
              </div>

              <h2 className="text-xl md:text-2xl font-black headline-font italic mb-6 text-white uppercase">Record Payment</h2>

              <form onSubmit={handleAddPayment} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Select Member</label>
                  <select required value={newPayment.memberId} onChange={(e) => setNewPayment({ ...newPayment, memberId: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all">
                    <option value="" disabled>Choose a member...</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Amount Given (Rs)</label>
                  <input type="number" required value={newPayment.amount} onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all" />
                </div>
                {selectedMember && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg border border-white/5 bg-zinc-950/60 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Plan</p>
                      <p className="mt-1 text-sm font-bold text-white">{selectedMember.planType}</p>
                    </div>
                    <div className="rounded-lg border border-white/5 bg-zinc-950/60 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Renewal Period</p>
                      <p className="mt-1 text-sm font-bold text-white">{selectedMember.planDuration} days</p>
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Payment Method</label>
                  <select value={newPayment.method} onChange={(e) => setNewPayment({ ...newPayment, method: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all">
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
